import { MealSlot } from '@prisma/client';

/** Comidas del día en orden, con su nombre colombiano por defecto. */
export const MEAL_ORDER: MealSlot[] = [MealSlot.DESAYUNO, MealSlot.MEDIAS_NUEVES, MealSlot.ALMUERZO, MealSlot.ONCES, MealSlot.COMIDA];

export const DEFAULT_MEAL_NAMES: Record<MealSlot, string> = {
  DESAYUNO: 'Desayuno',
  MEDIAS_NUEVES: 'Medias nueves',
  ALMUERZO: 'Almuerzo',
  ONCES: 'Onces',
  COMIDA: 'Comida',
};

/** Nombres guardados por el usuario sobre los de siempre (ignora lo que no sea un texto corto). */
export function mealNames(saved: unknown): Record<MealSlot, string> {
  const names = { ...DEFAULT_MEAL_NAMES };
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const slot of MEAL_ORDER) {
      const v = (saved as Record<string, unknown>)[slot];
      if (typeof v === 'string' && v.trim()) names[slot] = v.trim().slice(0, 30);
    }
  }
  return names;
}
