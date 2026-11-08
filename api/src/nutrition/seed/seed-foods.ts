/**
 * Carga la base compartida de NutriFer desde archivos PRIVADOS que no están en git (la tabla del
 * ICBF no se puede republicar y el repositorio es público):
 *
 *   node dist/nutrition/seed/seed-foods.js --dir /ruta/de/los/archivos [--dry-run]
 *
 * Lee de esa carpeta tcac-2018.json (obligatorio), p18.json y gaba-porciones.json (opcionales).
 * Les suma lo nuestro, que sí está en git: alimentos básicos, medidas caseras, sinónimos y platos
 * por partes (src/nutrition/data). Se puede correr las veces que haga falta: actualiza por código y
 * no duplica. Las anotaciones guardan sus propios valores, así que recargar no cambia el historial.
 */
import { FoodSource, Prisma, PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ALIASES } from '../data/aliases';
import { BASICS } from '../data/basics';
import { DISHES } from '../data/dishes';
import { PORTIONS } from '../data/portions';
import { PRIORITY } from '../data/priority';
import type { FoodRef } from '../data/types';
import { per100FromParts, type Per100 } from '../nutrition-math';
import { normalize, rank, wordsOf, type SearchItem } from '../search.utils';
import { portionLabel, slug, suspicious, tidyName } from './seed.utils';

type Per100In = Record<string, number | null | undefined>;
type TcacFile = { foods: { code: string; name: string; group?: string | null; per100g: Per100In }[] };
type P18File = { dishes: { name: string; tcacDishCode?: string | null; per100g: Per100In }[] };
type GabaFile = { portions: { food: string; measure: string; grams: number }[] };
type FoodRow = Per100 & { id: string; name: string; sourceCode: string | null };

const CORE = new Set(['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'satFat', 'sodium', 'kj', 'carbsAvailable']);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const log = (...a: unknown[]) => console.log('[nutrifer]', ...a);

function readJson<T>(path: string, required: boolean): T | null {
  if (!existsSync(path)) {
    if (required) throw new Error(`Falta el archivo ${path}`);
    log(`(no está ${path}: se omite)`);
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Valores por 100 g de un archivo: los básicos van en columnas y el resto en `nutrients`. */
function valuesOf(p: Per100In) {
  const kcal = num(p.kcal);
  const protein = num(p.protein);
  const fat = num(p.fat);
  const carbs = num(p.carbs);
  if (kcal == null || protein == null || fat == null || carbs == null) return null;
  const extra = Object.fromEntries(Object.entries(p).filter(([k, v]) => !CORE.has(k) && num(v) != null));
  return {
    kcal,
    protein,
    fat,
    carbs,
    fiber: num(p.fiber),
    sugar: num(p.sugar),
    satFat: num(p.satFat),
    sodium: num(p.sodium),
    nutrients: Object.keys(extra).length ? (extra as Prisma.InputJsonValue) : Prisma.DbNull,
  };
}

async function main() {
  const dir = arg('--dir') ?? process.env.NUTRIFER_DATA_DIR;
  const dryRun = process.argv.includes('--dry-run');
  if (!dir) throw new Error('Uso: node dist/nutrition/seed/seed-foods.js --dir <carpeta con tcac-2018.json>');
  const tcac = readJson<TcacFile>(join(dir, 'tcac-2018.json'), true) as TcacFile;
  const p18 = readJson<P18File>(join(dir, 'p18.json'), false);
  const gaba = readJson<GabaFile>(join(dir, 'gaba-porciones.json'), false);
  const prisma = new PrismaClient();
  const unresolved: string[] = [];

  try {
    /* ---------- 1. Tabla del ICBF ---------- */
    let saved = 0;
    const skipped: string[] = [];
    const flagged: string[] = [];
    for (const f of tcac.foods) {
      const v = f.code ? valuesOf(f.per100g) : null;
      if (!v) {
        skipped.push(`${f.code} ${f.name}`);
        continue;
      }
      const name = tidyName(f.name).slice(0, 160);
      if (suspicious(v)) flagged.push(`${f.code} ${name} (${v.kcal} kcal; P ${v.protein} G ${v.fat} C ${v.carbs})`);
      const data = { name, category: f.group ? tidyName(f.group).slice(0, 80) : null, searchText: wordsOf(name).join(' '), ...v, archived: false, priority: 0 };
      if (!dryRun) {
        await prisma.food.upsert({
          where: { source_sourceCode: { source: FoodSource.TCAC, sourceCode: f.code } },
          create: { source: FoodSource.TCAC, sourceCode: f.code, ...data },
          update: data,
        });
      }
      saved++;
    }
    log(`Tabla del ICBF: ${saved} alimentos${skipped.length ? `, ${skipped.length} sin valores completos` : ''}`);
    if (skipped.length) log('  Sin valores completos:', skipped.slice(0, 15).join(' | '));
    if (flagged.length) log(`  Para revisar (las kcal no cuadran con los macros): ${flagged.length}\n   ` + flagged.slice(0, 25).join('\n   '));

    /* ---------- 2. Alimentos básicos (agua) ---------- */
    for (const b of BASICS) {
      const data = {
        name: b.name,
        category: b.category,
        searchText: wordsOf(b.name, ...b.aliases).join(' '),
        ...b.per100,
        archived: false,
        priority: 3,
      };
      if (dryRun) continue;
      const food = await prisma.food.upsert({
        where: { source_sourceCode: { source: FoodSource.USDA, sourceCode: b.code } },
        create: { source: FoodSource.USDA, sourceCode: b.code, ...data },
        update: data,
      });
      await prisma.$transaction([
        prisma.foodPortion.deleteMany({ where: { foodId: food.id } }),
        prisma.foodPortion.createMany({
          data: b.portions.map(([label, grams, isDefault], i) => ({ foodId: food.id, label, grams, isDefault: !!isDefault, sortOrder: i })),
        }),
      ]);
    }

    // Índice para resolver medidas, sinónimos y platos por código o por nombre.
    const select = { id: true, name: true, sourceCode: true, kcal: true, protein: true, fat: true, carbs: true, fiber: true, sugar: true, sodium: true };
    const rows: FoodRow[] = await prisma.food.findMany({ where: { ownerId: null, source: FoodSource.TCAC }, select });
    const basics: FoodRow[] = await prisma.food.findMany({ where: { ownerId: null, source: FoodSource.USDA, sourceCode: { in: BASICS.map((b) => b.code) } }, select });
    const known: (SearchItem & { food: FoodRow })[] = rows.map((r) => ({ id: r.id, name: normalize(r.name), words: wordsOf(r.name), source: 'TCAC', food: r }));
    const byCode = new Map([...rows, ...basics].map((r) => [r.sourceCode ?? '', r]));
    const resolve = (ref: FoodRef, limit = 1): FoodRow[] => {
      if (ref.code) {
        const hit = byCode.get(ref.code);
        return hit ? [hit] : [];
      }
      return ref.match ? rank(known, ref.match, limit).map((k) => k.food) : [];
    };

    /* ---------- 3. Sinónimos ---------- */
    const extraWords = new Map<string, string[]>();
    for (const a of ALIASES) {
      const hits = resolve(a, a.limit ?? 1);
      if (!hits.length) unresolved.push(`sinónimo ${a.code ?? a.match}`);
      for (const h of hits) extraWords.set(h.id, [...(extraWords.get(h.id) ?? []), ...a.words]);
    }
    if (!dryRun) {
      for (const [id, words] of extraWords) {
        const food = rows.find((r) => r.id === id);
        if (food) await prisma.food.update({ where: { id }, data: { searchText: wordsOf(food.name, ...words).join(' ') } });
      }
    }
    log(`Sinónimos: ${extraWords.size} alimentos`);

    /* ---------- 4. Medidas caseras ---------- */
    const portionsBy = new Map<string, { label: string; grams: number; isDefault: boolean }[]>();
    const addPortion = (foodId: string, label: string, grams: number, isDefault: boolean) => {
      const list = portionsBy.get(foodId) ?? [];
      if (!(grams > 0) || list.some((p) => normalize(p.label) === normalize(label))) return;
      list.push({ label: label.slice(0, 80), grams, isDefault });
      portionsBy.set(foodId, list);
    };
    let gabaHits = 0;
    const gabaMiss: string[] = [];
    for (const g of gaba?.portions ?? []) {
      const hit = rank(known, g.food, 1)[0];
      // Solo si el nombre de las guías coincide de verdad (todas sus palabras están en el de la tabla).
      if (hit && wordsOf(g.food).every((w) => hit.words.some((x) => x === w || x.startsWith(w)))) {
        addPortion(hit.id, portionLabel(g.measure), g.grams, false);
        gabaHits++;
      } else gabaMiss.push(g.food);
    }
    if (gaba) log(`Medidas de las guías: ${gabaHits} asignadas; ${gabaMiss.length} sin un alimento igual en la tabla`);
    for (const rule of PORTIONS) {
      const hits = resolve(rule, rule.limit ?? 1);
      if (!hits.length) unresolved.push(`medida ${rule.code ?? rule.match}`);
      for (const h of hits) {
        // Las nuestras van primero y mandan como medida por defecto.
        const ours = rule.portions.map(([label, grams, isDefault]) => ({ label: label.slice(0, 80), grams, isDefault: !!isDefault }));
        const theirs = (portionsBy.get(h.id) ?? []).filter((p) => !ours.some((o) => normalize(o.label) === normalize(p.label))).map((p) => ({ ...p, isDefault: false }));
        portionsBy.set(h.id, [...ours, ...theirs]);
      }
    }
    if (!dryRun) {
      for (const [foodId, list] of portionsBy) {
        if (!list.some((p) => p.isDefault)) list[0].isDefault = true;
        await prisma.$transaction([
          prisma.foodPortion.deleteMany({ where: { foodId } }),
          prisma.foodPortion.createMany({ data: list.map((p, i) => ({ foodId, label: p.label, grams: p.grams, isDefault: p.isDefault, sortOrder: i })) }),
        ]);
      }
    }
    log(`Medidas caseras: ${portionsBy.size} alimentos con medida`);

    /* ---------- Prioridad en la búsqueda: lo de todos los días arriba ---------- */
    const curated = new Set(PORTIONS.flatMap((r) => resolve(r, r.limit ?? 1).map((f) => f.id)));
    const priority = new Map<string, number>();
    for (const r of rows) {
      let p = curated.has(r.id) ? 6 : 0;
      if (extraWords.has(r.id)) p += 2;
      if (!curated.has(r.id) && r.sourceCode?.startsWith('S')) p += 2; // preparaciones típicas de la tabla
      if (p) priority.set(r.id, p);
    }
    for (const rule of PRIORITY) {
      const hit = byCode.get(rule.code);
      if (hit) priority.set(hit.id, rule.priority);
      else unresolved.push(`prioridad ${rule.code}`);
    }
    if (!dryRun) {
      const byValue = new Map<number, string[]>();
      for (const [id, p] of priority) byValue.set(p, [...(byValue.get(p) ?? []), id]);
      for (const [p, ids] of byValue) await prisma.food.updateMany({ where: { id: { in: ids } }, data: { priority: p } });
    }
    log(`Prioridad: ${[...priority.values()].filter((p) => p > 0).length} arriba, ${[...priority.values()].filter((p) => p < 0).length} abajo`);

    /* ---------- 5. Preparaciones medidas por el ICBF que no estén ya en la tabla ---------- */
    let p18Added = 0;
    for (const d of p18?.dishes ?? []) {
      if (d.tcacDishCode && byCode.has(d.tcacDishCode)) continue; // ya está en la tabla (grupo S)
      const v = valuesOf(d.per100g);
      if (!v) continue;
      const name = tidyName(d.name).slice(0, 160);
      const data = { name, category: 'Preparaciones tradicionales', searchText: wordsOf(name).join(' '), ...v, archived: false };
      if (!dryRun) {
        const key = slug(d.name);
        await prisma.food.upsert({
          where: { source_sourceCode: { source: FoodSource.P18, sourceCode: key } },
          create: { source: FoodSource.P18, sourceCode: key, ...data },
          update: data,
        });
      }
      p18Added++;
    }
    if (p18) log(`Preparaciones del ICBF que no estaban en la tabla: ${p18Added}`);

    /* ---------- 6. Platos por partes ---------- */
    let dishes = 0;
    for (const d of DISHES) {
      const parts = d.parts.map((p) => ({ ...p, food: resolve(p)[0] }));
      const missing = parts.filter((p) => !p.food);
      if (missing.length) {
        unresolved.push(`plato «${d.name}»: ${missing.map((m) => `${m.label} (${m.code ?? m.match})`).join(', ')}`);
        continue;
      }
      const per100 = per100FromParts(parts.map((p) => ({ per100: p.food, grams: p.grams })));
      const grams = parts.reduce((g, p) => g + p.grams, 0);
      const whole = d.replaces ? byCode.get(d.replaces) : undefined;
      log(
        `  ${d.name}: ${Math.round((per100.kcal * grams) / 100)} kcal en ${grams} g (${Math.round(per100.kcal)}/100 g)` +
          (whole ? ` · la tabla trae el plato entero con ${Math.round(whole.kcal)}/100 g` : ''),
      );
      if (dryRun) {
        dishes++;
        continue;
      }
      const data = {
        name: d.name,
        category: d.category ?? 'Platos',
        searchText: wordsOf(d.name, ...(d.aliases ?? [])).join(' '),
        kcal: per100.kcal,
        protein: per100.protein,
        fat: per100.fat,
        carbs: per100.carbs,
        fiber: per100.fiber ?? null,
        sugar: per100.sugar ?? null,
        sodium: per100.sodium ?? null,
        archived: false,
        priority: d.priority ?? 4,
      };
      const key = slug(d.name);
      const food = await prisma.food.upsert({
        where: { source_sourceCode: { source: FoodSource.DISH, sourceCode: key } },
        create: { source: FoodSource.DISH, sourceCode: key, ...data },
        update: data,
      });
      await prisma.$transaction([
        prisma.dishPart.deleteMany({ where: { dishId: food.id } }),
        prisma.dishPart.createMany({ data: parts.map((p, i) => ({ dishId: food.id, foodId: p.food.id, label: p.label, grams: p.grams, sortOrder: i })) }),
        prisma.foodPortion.deleteMany({ where: { foodId: food.id } }),
        prisma.foodPortion.createMany({ data: [{ foodId: food.id, label: d.portion ?? 'Plato', grams, isDefault: true, sortOrder: 0 }] }),
      ]);
      // El plato entero de la tabla queda oculto: en la búsqueda sale el que se arma por partes.
      if (whole) await prisma.food.update({ where: { id: whole.id }, data: { archived: true } });
      dishes++;
    }
    log(`Platos por partes: ${dishes} de ${DISHES.length}`);
    if (unresolved.length) log(`Sin resolver (${unresolved.length}):\n   ` + unresolved.join('\n   '));
    log(dryRun ? 'Prueba en seco: no se guardó nada.' : 'Listo.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[nutrifer] Falló la carga:', err);
  process.exitCode = 1;
});
