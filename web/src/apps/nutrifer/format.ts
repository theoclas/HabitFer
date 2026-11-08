/** Textos de NutriFer para las filas de alimentos (sin React, para poder probarlos con Node). */
import { quantityText } from "./math.ts";
import type { FoodResult, LastAmount } from "./types";

export type AmountLine = { text: string; kcal: number };

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** «1 arepa pequeña», «2 × pocillo»; una medida que ya dice cuántos («2 huevos») va sola. */
export function portionText(label: string, quantity: number): string {
  const l = lower(label);
  if (quantity !== 1) return `${quantityText(quantity)} × ${l}`;
  return /^[\d½¼¾]/.test(l) ? l : `1 ${l}`;
}

/** Una medida que ya dice el peso («100 g», «330 ml»): no se repite («100 g · 100 g»). */
const saysWeight = (label: string) => /^\d+(?:[.,]\d+)?\s*(?:g|ml)$/i.test(label.trim());

/** «1 arepa pequeña · 56 g» o «2 × pocillo»: lo que se anotó la última vez. */
export function lastAmount(last: LastAmount): AmountLine {
  const { portionLabel, quantity, grams, kcal } = last;
  // El servidor ya lo trae escrito (con «frito, +5 g de aceite» si lo lleva).
  if (last.amount) return { text: last.amount, kcal };
  if (!portionLabel) return { text: grams != null ? `${Math.round(grams)} g` : "100 g", kcal };
  const amount = portionText(portionLabel, quantity);
  if (grams == null || (quantity === 1 && saysWeight(portionLabel))) return { text: amount, kcal };
  return { text: `${amount} · ${Math.round(grams)} g`, kcal };
}

/** La medida por defecto del alimento (o 100 g). */
export function defaultAmount(food: FoodResult): AmountLine {
  if (food.portion) {
    const amount = portionText(food.portion.label, 1);
    return { text: saysWeight(food.portion.label) ? amount : `${amount} · ${Math.round(food.portion.grams)} g`, kcal: food.kcalPortion ?? food.kcal100 };
  }
  return { text: "100 g", kcal: food.kcal100 };
}

/** «desayuno», «medias nueves»: el nombre de la comida dentro de una frase. */
export const inMeal = (name: string) => lower(name);

/** «1 cosa», «3 cosas». */
export const thingsText = (n: number) => `${n} ${n === 1 ? "cosa" : "cosas"}`;
