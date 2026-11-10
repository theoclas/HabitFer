/**
 * Trae de Open Food Facts los empacados que más se compran en Colombia (lista de códigos en
 * src/nutrition/data/packaged.ts) y los deja en la base compartida, igual que si se hubieran
 * escaneado: así salen en la búsqueda normal sin tener que escanearlos ni buscarlos aparte.
 *
 *   node dist/nutrition/seed/seed-packaged.js [--dry-run] [--refresh]
 *
 * Sin --refresh se salta los que ya están guardados. Respeta el límite de Open Food Facts (una
 * consulta cada 4,5 s, unas 13 por minuto). Los productos cuyas calorías no cuadran con sus macros
 * no se guardan (se avisan). Se guardan con el nombre de la lista. La api los ve sola en máximo
 * 2 minutos.
 */
import { FoodSource, PrismaClient } from '@prisma/client';
import { PACKAGED } from '../data/packaged';
import { offToFood } from '../packaged/off.map';
import { OpenFoodFactsClient } from '../packaged/open-food-facts.client';
import { savePackaged } from '../packaged/save-packaged';
import { packagedPlan } from './seed.utils';

const GAP_MS = 4500;
const log = (...a: unknown[]) => console.log('[nutrifer]', ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const refresh = process.argv.includes('--refresh');
  const prisma = new PrismaClient();
  const off = new OpenFoodFactsClient();
  try {
    const codes = PACKAGED.map((p) => p.code);
    const saved = await prisma.food.findMany({ where: { source: FoodSource.OFF, sourceCode: { in: codes } }, select: { sourceCode: true } });
    const plan = packagedPlan(PACKAGED, new Set(saved.map((s) => s.sourceCode ?? '')), refresh);
    log(`Empacados en la lista: ${PACKAGED.length}; por traer: ${plan.fetch.length}; ya guardados: ${plan.skip.length}`);
    if (plan.invalid.length) log(`  Códigos que no son de barras (se omiten): ${plan.invalid.join(', ')}`);

    const nameOf = new Map(PACKAGED.map((p) => [p.code, p.name]));
    const done: string[] = [];
    const notFound: string[] = [];
    const noTable: string[] = [];
    const flagged: string[] = [];
    const failed: string[] = [];
    for (const [i, code] of plan.fetch.entries()) {
      if (i > 0) await sleep(GAP_MS);
      const label = `${code} ${nameOf.get(code) ?? ''}`.trim();
      try {
        const product = await off.product(code);
        if (!product) {
          notFound.push(label);
          continue;
        }
        const food = offToFood(product, code);
        if (!food) {
          noTable.push(label);
          continue;
        }
        if (food.check) {
          flagged.push(`${label} (${Math.round(food.per100.kcal)} kcal; P ${food.per100.protein} G ${food.per100.fat} C ${food.per100.carbs})`);
          continue;
        }
        // Con el nombre de la lista: el de Open Food Facts suele venir desordenado.
        const named = { ...food, name: nameOf.get(code) || food.name };
        if (!dryRun) await savePackaged(prisma, named);
        done.push(`${named.name} · ${Math.round(named.per100.kcal)} kcal/100 g`);
      } catch (err) {
        failed.push(`${label}: ${(err as Error).message}`);
      }
    }
    log(`${dryRun ? 'Se guardarían' : 'Guardados'}: ${done.length}`);
    for (const d of done) log(`   ${d}`);
    if (notFound.length) log(`Open Food Facts no los tiene (${notFound.length}):\n   ` + notFound.join('\n   '));
    if (noTable.length) log(`Sin tabla nutricional (${noTable.length}):\n   ` + noTable.join('\n   '));
    if (flagged.length) log(`No cuadran, no se guardan (${flagged.length}):\n   ` + flagged.join('\n   '));
    if (failed.length) log(`Fallaron (${failed.length}), se pueden reintentar:\n   ` + failed.join('\n   '));
    log(dryRun ? 'Prueba en seco: no se guardó nada.' : 'Listo. La api los muestra en la búsqueda en máximo 2 minutos.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[nutrifer] Falló la carga de empacados:', err);
  process.exitCode = 1;
});
