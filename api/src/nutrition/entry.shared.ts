/** Piezas comunes de las anotaciones: cómo se leen de la base, cómo se muestran y cómo se copian. */
import { BadRequestException } from '@nestjs/common';
import { Prisma, type MealEntry } from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date.utils';
import { amountText, computeEntry, EntryInputError, inputFromSaved, type EntryInput, type EntryValues, type FoodForEntry } from './entry.utils';
import type { Totals } from './nutrition-math';

export const FOOD_FOR_ENTRY = {
  portions: true,
  parts: { orderBy: { sortOrder: 'asc' }, include: { food: true } },
} satisfies Prisma.FoodInclude;

export type FoodRow = Prisma.FoodGetPayload<{ include: typeof FOOD_FOR_ENTRY }>;

export function asFood(row: FoodRow): FoodForEntry {
  return {
    id: row.id,
    name: row.name,
    kcal: row.kcal,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    fiber: row.fiber,
    sugar: row.sugar,
    sodium: row.sodium,
    portions: row.portions.map((p) => ({ id: p.id, label: p.label, grams: p.grams, isDefault: p.isDefault })),
    parts: row.parts.map((p) => ({ id: p.id, label: p.label, grams: p.grams, foodId: p.foodId, food: p.food })),
  };
}

/** computeEntry con el error convertido en un 400 con el mensaje en español. */
export function computeOr400(food: FoodRow, input: EntryInput): EntryValues {
  try {
    return computeEntry(asFood(food), input);
  } catch (err) {
    if (err instanceof EntryInputError) throw new BadRequestException(err.message);
    throw err;
  }
}

export function totalsOf(e: { kcal: number; protein: number; fat: number; carbs: number; fiber: number | null; sugar: number | null; sodium: number | null }): Totals {
  return { kcal: e.kcal, protein: e.protein, fat: e.fat, carbs: e.carbs, fiber: e.fiber ?? 0, sugar: e.sugar ?? 0, sodium: e.sodium ?? 0 };
}

export function entryView(e: MealEntry) {
  return {
    id: e.id,
    date: toDateKey(e.date),
    meal: e.meal,
    foodId: e.foodId,
    name: e.name,
    quick: e.quick,
    portionLabel: e.portionLabel,
    portionGrams: e.portionGrams,
    quantity: e.quantity,
    grams: e.grams,
    prep: e.prep,
    oilGrams: e.oilGrams,
    amount: amountText(e),
    kcal: e.kcal,
    protein: e.protein,
    fat: e.fat,
    carbs: e.carbs,
    fiber: e.fiber,
    sugar: e.sugar,
    sodium: e.sodium,
    parts: e.parts,
  };
}

/** AAAA-MM-DD que exista de verdad (no 2026-02-31) y razonable. */
export function checkedDate(key: string): Date {
  const date = parseDateKey(key);
  if (Number.isNaN(date.getTime()) || toDateKey(date) !== key) throw new BadRequestException('Esa fecha no existe.');
  const year = date.getUTCFullYear();
  if (year < 2000 || year > new Date().getFullYear() + 1) throw new BadRequestException('Esa fecha está fuera de rango.');
  return date;
}

/** Lo que hace falta para volver a anotar algo: una anotación vieja o lo que lleva una comida guardada. */
export type Template = Pick<
  MealEntry,
  | 'foodId'
  | 'quick'
  | 'name'
  | 'portionLabel'
  | 'portionGrams'
  | 'quantity'
  | 'grams'
  | 'kcal'
  | 'protein'
  | 'fat'
  | 'carbs'
  | 'fiber'
  | 'sugar'
  | 'sodium'
  | 'parts'
  | 'prep'
  | 'oilGrams'
>;

/** Columnas de una anotación nueva hecha con una plantilla, sin usuario, día ni comida. */
export type TemplateData = Omit<Prisma.MealEntryUncheckedCreateInput, 'userId' | 'date' | 'meal'>;

const jsonOrNull = (v: Prisma.JsonValue | null): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue);

/**
 * Los valores de una plantilla. Si el alimento sigue en la base se recalcula con la misma medida,
 * cantidad, partes y preparación (por si la tabla se corrigió); si no, se copia tal cual.
 */
export function fromTemplate(t: Template, food: FoodRow | undefined): TemplateData {
  if (food && !t.quick) {
    try {
      const v = computeEntry(asFood(food), inputFromSaved(t));
      return {
        foodId: food.id,
        quick: false,
        name: v.name,
        portionLabel: v.portionLabel,
        portionGrams: v.portionGrams,
        quantity: v.quantity,
        grams: v.grams,
        ...v.totals,
        parts: v.parts ?? Prisma.DbNull,
        prep: v.prep,
        oilGrams: v.oilGrams,
      };
    } catch {
      // Una plantilla que ya no cuadra con el alimento (p. ej. partes que cambiaron): se copia.
    }
  }
  return {
    foodId: t.quick || !food ? null : food.id,
    quick: t.quick,
    name: t.name,
    portionLabel: t.portionLabel,
    portionGrams: t.portionGrams,
    quantity: t.quantity,
    grams: t.grams,
    kcal: t.kcal,
    protein: t.protein,
    fat: t.fat,
    carbs: t.carbs,
    fiber: t.fiber,
    sugar: t.sugar,
    sodium: t.sodium,
    parts: jsonOrNull(t.parts),
    prep: t.prep,
    oilGrams: t.oilGrams,
  };
}
