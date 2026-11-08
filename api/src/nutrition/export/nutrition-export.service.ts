import { BadRequestException, Injectable } from '@nestjs/common';
import { FoodSource, MealSlot, WeightSource, type Prisma } from '@prisma/client';
import { localTodayKey, parseDateKey, toDateKey } from '../../common/date.utils';
import { cleanText, toCsv, validDateKey } from '../../export/export.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { MEAL_ORDER, mealNames } from '../meals';
import { wordsOf } from '../search.utils';

export const NUTRITION_BACKUP_APP = 'NutriFer';
export const NUTRITION_BACKUP_VERSION = 1;
const MAX_ROWS = 100_000;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new BadRequestException('El respaldo de NutriFer tiene un formato inesperado.');
  if (v.length > MAX_ROWS) throw new BadRequestException('El respaldo es demasiado grande para importarlo de una vez.');
  return v;
};
const num = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);
const r2 = (n: number) => Math.round(n * 100) / 100;

export type NutritionImportReport = {
  entries: number;
  water: number;
  weights: number;
  fasts: number;
  foods: number;
  savedMeals: number;
};

/**
 * Respaldo de NutriFer: el diario de comida, el agua, el peso, los ayunos, los alimentos propios y las comidas
 * guardadas, en JSON (también dentro del respaldo de HabitFer) y el diario en CSV para Excel. Importar suma lo
 * que falta y nunca borra ni cambia lo que ya existe.
 */
@Injectable()
export class NutritionExportService {
  constructor(private prisma: PrismaService) {}

  async exportJson(userId: string) {
    const [profile, entries, days, weights, fasts, foods, saved] = await Promise.all([
      this.prisma.nutritionProfile.findUnique({ where: { userId } }),
      this.prisma.mealEntry.findMany({ where: { userId }, orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.nutritionDay.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
      this.prisma.bodyWeight.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
      this.prisma.fast.findMany({ where: { userId }, orderBy: { startedAt: 'asc' } }),
      this.prisma.food.findMany({
        where: { ownerId: userId, source: { in: [FoodSource.USER, FoodSource.RECIPE] } },
        include: {
          portions: { orderBy: { sortOrder: 'asc' } },
          ingredients: { include: { food: { select: { name: true } } }, orderBy: { sortOrder: 'asc' } },
        },
      }),
      this.prisma.savedMeal.findMany({ where: { userId }, include: { items: { orderBy: { sortOrder: 'asc' } } } }),
    ]);
    const key = (d: Date) => toDateKey(d);
    return {
      app: NUTRITION_BACKUP_APP,
      version: NUTRITION_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      profile: profile
        ? {
            sex: profile.sex,
            birthYear: profile.birthYear,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            activity: profile.activity,
            goal: profile.goal,
            ratePerWeek: profile.ratePerWeek,
            manual: profile.manual,
            adaptive: profile.adaptive,
            targets: { kcal: profile.kcalTarget, protein: profile.proteinTarget, fat: profile.fatTarget, carbs: profile.carbsTarget },
            mealNames: mealNames(profile.mealNames),
            waterGoalMl: profile.waterGoalMl,
            glassMl: profile.glassMl,
            fastGoalHours: profile.fastGoalHours,
          }
        : null,
      entries: entries.map((e) => ({
        date: key(e.date),
        meal: e.meal,
        name: e.name,
        quick: e.quick,
        portionLabel: e.portionLabel,
        portionGrams: e.portionGrams,
        quantity: e.quantity,
        grams: e.grams,
        kcal: r2(e.kcal),
        protein: r2(e.protein),
        fat: r2(e.fat),
        carbs: r2(e.carbs),
        fiber: e.fiber == null ? null : r2(e.fiber),
        sugar: e.sugar == null ? null : r2(e.sugar),
        sodium: e.sodium == null ? null : r2(e.sodium),
        prep: e.prep,
        oilGrams: e.oilGrams,
        foodId: e.foodId,
      })),
      water: days.filter((d) => d.waterMl > 0).map((d) => ({ date: key(d.date), ml: d.waterMl })),
      weights: weights.map((w) => ({ date: key(w.date), kg: w.kg, source: w.source })),
      fasts: fasts.map((f) => ({ startedAt: f.startedAt.toISOString(), endedAt: f.endedAt?.toISOString() ?? null, goalHours: f.goalHours })),
      foods: foods.map((f) => ({
        source: f.source,
        name: f.name,
        brand: f.brand,
        barcode: f.barcode,
        per100: { kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs, fiber: f.fiber, sugar: f.sugar, satFat: f.satFat, sodium: f.sodium },
        portions: f.portions.map((p) => ({ label: p.label, grams: p.grams, isDefault: p.isDefault })),
        ...(f.source === FoodSource.RECIPE
          ? { servings: f.servings, cookedGrams: f.cookedGrams, ingredients: f.ingredients.map((i) => ({ name: i.food.name, grams: i.grams, portionLabel: i.portionLabel, quantity: i.quantity })) }
          : {}),
      })),
      savedMeals: saved.map((s) => ({
        name: s.name,
        meal: s.meal,
        items: s.items.map((i) => ({
          name: i.name,
          quick: i.quick,
          portionLabel: i.portionLabel,
          portionGrams: i.portionGrams,
          quantity: i.quantity,
          grams: i.grams,
          kcal: r2(i.kcal),
          protein: r2(i.protein),
          fat: r2(i.fat),
          carbs: r2(i.carbs),
          foodId: i.foodId,
        })),
      })),
    };
  }

  /** El diario en CSV (una fila por cosa anotada), con los nombres de las comidas de la persona. */
  async exportCsv(userId: string): Promise<string> {
    const [entries, profile] = await Promise.all([
      this.prisma.mealEntry.findMany({ where: { userId }, orderBy: [{ date: 'asc' }, { meal: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.nutritionProfile.findUnique({ where: { userId }, select: { mealNames: true } }),
    ]);
    const names = mealNames(profile?.mealNames);
    const order = new Map(MEAL_ORDER.map((m, i) => [m, i]));
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime() || (order.get(a.meal) ?? 0) - (order.get(b.meal) ?? 0));
    const dec = (n: number | null) => (n == null ? '' : String(Math.round(n * 10) / 10).replace('.', ','));
    return toCsv([
      ['Fecha', 'Comida', 'Alimento', 'Cantidad', 'Gramos', 'Calorías (kcal)', 'Proteína (g)', 'Carbohidratos (g)', 'Grasa (g)', 'Fibra (g)', 'Azúcar (g)', 'Sodio (mg)', 'Registro rápido'],
      ...sorted.map((e) => [
        toDateKey(e.date),
        names[e.meal],
        e.name,
        e.portionLabel ? `${String(e.quantity).replace('.', ',')} × ${e.portionLabel}` : '',
        e.grams == null ? '' : Math.round(e.grams),
        Math.round(e.kcal),
        dec(e.protein),
        dec(e.carbs),
        dec(e.fat),
        dec(e.fiber),
        dec(e.sugar),
        e.sodium == null ? '' : Math.round(e.sodium),
        e.quick ? 'sí' : '',
      ]),
    ]);
  }

  /** Importar un respaldo de NutriFer (o la parte `nutrition` del de HabitFer): suma lo que falta. */
  async importJson(userId: string, body: unknown): Promise<NutritionImportReport> {
    if (!isObj(body) || body.app !== NUTRITION_BACKUP_APP || body.version !== NUTRITION_BACKUP_VERSION) {
      throw new BadRequestException('Este archivo no es un respaldo de NutriFer.');
    }
    const today = localTodayKey();
    const report: NutritionImportReport = { entries: 0, water: 0, weights: 0, fasts: 0, foods: 0, savedMeals: 0 };
    const known = new Set((await this.prisma.food.findMany({ select: { id: true } })).map((f) => f.id));

    // Diario: una cosa ya está si coincide día, comida, nombre y calorías.
    const existing = await this.prisma.mealEntry.findMany({ where: { userId }, select: { date: true, meal: true, name: true, kcal: true } });
    const seen = new Set(existing.map((e) => `${toDateKey(e.date)}|${e.meal}|${e.name}|${Math.round(e.kcal)}`));
    const entries: Prisma.MealEntryCreateManyInput[] = [];
    for (const r of list(body.entries).filter(isObj)) {
      const date = validDateKey(r.date, today);
      const meal = typeof r.meal === 'string' && (MEAL_ORDER as string[]).includes(r.meal) ? (r.meal as MealSlot) : null;
      const name = cleanText(r.name, 160);
      const kcal = num(r.kcal, 0, 20000);
      if (!date || !meal || !name || kcal == null) continue;
      const k = `${date}|${meal}|${name}|${Math.round(kcal)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const foodId = typeof r.foodId === 'string' && known.has(r.foodId) ? r.foodId : null;
      entries.push({
        userId,
        date: parseDateKey(date),
        meal,
        name,
        foodId,
        quick: r.quick === true || !foodId,
        portionLabel: cleanText(r.portionLabel, 80),
        portionGrams: num(r.portionGrams, 0, 10000),
        quantity: num(r.quantity, 0, 1000) ?? 1,
        grams: num(r.grams, 0, 20000),
        kcal,
        protein: num(r.protein, 0, 2000) ?? 0,
        fat: num(r.fat, 0, 2000) ?? 0,
        carbs: num(r.carbs, 0, 5000) ?? 0,
        fiber: num(r.fiber, 0, 1000),
        sugar: num(r.sugar, 0, 5000),
        sodium: num(r.sodium, 0, 100000),
        oilGrams: num(r.oilGrams, 0, 300),
      });
    }
    if (entries.length) report.entries = (await this.prisma.mealEntry.createMany({ data: entries })).count;

    // Agua y peso: solo los días que no tienen.
    const water = list(body.water)
      .filter(isObj)
      .flatMap((r) => {
        const date = validDateKey(r.date, today);
        const ml = num(r.ml, 1, 20000);
        return date && ml ? [{ userId, date: parseDateKey(date), waterMl: Math.round(ml) }] : [];
      });
    if (water.length) report.water = (await this.prisma.nutritionDay.createMany({ data: water, skipDuplicates: true })).count;
    const weights = list(body.weights)
      .filter(isObj)
      .flatMap((r) => {
        const date = validDateKey(r.date, today);
        const kg = num(r.kg, 25, 350);
        return date && kg ? [{ userId, date: parseDateKey(date), kg, source: r.source === WeightSource.SHORTCUT ? WeightSource.SHORTCUT : WeightSource.MANUAL }] : [];
      });
    if (weights.length) report.weights = (await this.prisma.bodyWeight.createMany({ data: weights, skipDuplicates: true })).count;

    // Ayunos: los que no empezaron a la misma hora.
    const starts = new Set((await this.prisma.fast.findMany({ where: { userId }, select: { startedAt: true } })).map((f) => f.startedAt.getTime()));
    const fasts = list(body.fasts)
      .filter(isObj)
      .flatMap((r) => {
        const s = typeof r.startedAt === 'string' ? new Date(r.startedAt) : null;
        const e = typeof r.endedAt === 'string' ? new Date(r.endedAt) : null;
        const goal = num(r.goalHours, 10, 72);
        if (!s || Number.isNaN(s.getTime()) || starts.has(s.getTime()) || !goal || !e || Number.isNaN(e.getTime()) || e <= s) return [];
        starts.add(s.getTime());
        return [{ userId, startedAt: s, endedAt: e, goalHours: Math.round(goal), notifiedAt: e }];
      });
    if (fasts.length) report.fasts = (await this.prisma.fast.createMany({ data: fasts })).count;

    // Alimentos propios (no las recetas, que dependen de otros alimentos): por nombre.
    const ownNames = new Set(
      (await this.prisma.food.findMany({ where: { ownerId: userId }, select: { name: true } })).map((f) => f.name.toLocaleLowerCase('es')),
    );
    for (const r of list(body.foods).filter(isObj)) {
      if (r.source !== FoodSource.USER) continue;
      const name = cleanText(r.name, 160);
      const p = isObj(r.per100) ? r.per100 : null;
      const kcal = p ? num(p.kcal, 0, 1000) : null;
      if (!name || !p || kcal == null || ownNames.has(name.toLocaleLowerCase('es'))) continue;
      ownNames.add(name.toLocaleLowerCase('es'));
      const brand = cleanText(r.brand, 120);
      const portions = list(r.portions)
        .filter(isObj)
        .flatMap((x, i) => {
          const label = cleanText(x.label, 80);
          const grams = num(x.grams, 0.1, 5000);
          return label && grams ? [{ label, grams, isDefault: x.isDefault === true, sortOrder: i }] : [];
        });
      await this.prisma.food.create({
        data: {
          source: FoodSource.USER,
          name,
          searchText: wordsOf(name, brand).join(' '),
          ownerId: userId,
          brand,
          barcode: typeof r.barcode === 'string' && /^\d{8,14}$/.test(r.barcode) ? r.barcode : null,
          kcal,
          protein: num(p.protein, 0, 100) ?? 0,
          fat: num(p.fat, 0, 100) ?? 0,
          carbs: num(p.carbs, 0, 100) ?? 0,
          fiber: num(p.fiber, 0, 100),
          sugar: num(p.sugar, 0, 100),
          satFat: num(p.satFat, 0, 100),
          sodium: num(p.sodium, 0, 50000),
          portions: { create: portions.length ? portions : [{ label: '100 g', grams: 100, isDefault: true }] },
        },
      });
      report.foods++;
    }

    // Comidas guardadas: por nombre; lo que no exista aquí queda como registro rápido.
    const savedNames = new Set(
      (await this.prisma.savedMeal.findMany({ where: { userId }, select: { name: true } })).map((s) => s.name.toLocaleLowerCase('es')),
    );
    for (const r of list(body.savedMeals).filter(isObj)) {
      const name = cleanText(r.name, 80);
      if (!name || savedNames.has(name.toLocaleLowerCase('es'))) continue;
      const items = list(r.items)
        .filter(isObj)
        .flatMap((x, i) => {
          const itemName = cleanText(x.name, 160);
          const kcal = num(x.kcal, 0, 20000);
          if (!itemName || kcal == null) return [];
          const foodId = typeof x.foodId === 'string' && known.has(x.foodId) ? x.foodId : null;
          return [
            {
              name: itemName,
              foodId,
              quick: x.quick === true || !foodId,
              portionLabel: cleanText(x.portionLabel, 80),
              portionGrams: num(x.portionGrams, 0, 10000),
              quantity: num(x.quantity, 0, 1000) ?? 1,
              grams: num(x.grams, 0, 20000),
              kcal,
              protein: num(x.protein, 0, 2000) ?? 0,
              fat: num(x.fat, 0, 2000) ?? 0,
              carbs: num(x.carbs, 0, 5000) ?? 0,
              sortOrder: i,
            },
          ];
        });
      if (!items.length) continue;
      savedNames.add(name.toLocaleLowerCase('es'));
      const meal = typeof r.meal === 'string' && (MEAL_ORDER as string[]).includes(r.meal) ? (r.meal as MealSlot) : null;
      await this.prisma.savedMeal.create({ data: { userId, name, meal, items: { create: items } } });
      report.savedMeals++;
    }
    return report;
  }
}
