import { FoodSource, Prisma, type PrismaClient } from '@prisma/client';
import { wordsOf } from '../search.utils';
import type { PackagedFood } from './off.map';

/** Empacados de Open Food Facts: abajo de lo básico en la búsqueda, salvo que se busquen por su nombre o marca. */
export const OFF_PRIORITY = -1;

/**
 * Guarda un empacado en la base compartida (o lo actualiza si ya estaba) con sus medidas. Lo usan
 * el lector de códigos de la app y el cargador de empacados populares (seed-packaged), así los dos
 * quedan iguales.
 */
export async function savePackaged(prisma: PrismaClient, f: PackagedFood): Promise<string> {
  const data = {
    name: f.name,
    searchText: wordsOf(f.name, f.brand).join(' '),
    category: 'Empacados',
    brand: f.brand,
    barcode: f.code,
    kcal: f.per100.kcal,
    protein: f.per100.protein,
    fat: f.per100.fat,
    carbs: f.per100.carbs,
    fiber: f.per100.fiber,
    sugar: f.per100.sugar,
    satFat: f.per100.satFat,
    sodium: f.per100.sodium,
    nutrients: { transFat: f.transFat, sweetener: f.sweetener, check: f.check, estimated: f.estimated, liquid: f.liquid } as Prisma.InputJsonValue,
    priority: OFF_PRIORITY,
    archived: false,
  };
  const portions = f.portions.map((p, i) => ({ ...p, sortOrder: i }));
  const row = await prisma.food.upsert({
    where: { source_sourceCode: { source: FoodSource.OFF, sourceCode: f.code } },
    create: { source: FoodSource.OFF, sourceCode: f.code, ...data },
    update: data,
    select: { id: true },
  });
  // Las medidas se cambian juntas. Transacción en lote (no interactiva): con muchos guardados
  // seguidos, la interactiva fallaba con «Unable to start a transaction in the given time».
  await prisma.$transaction([
    prisma.foodPortion.deleteMany({ where: { foodId: row.id } }),
    prisma.foodPortion.createMany({ data: portions.map((p) => ({ ...p, foodId: row.id })) }),
  ]);
  return row.id;
}
