/** Cuentas de NutriFer en el teléfono, para ver el total mientras se elige (el servidor las repite al guardar). */
import type { AmountChoice, FoodDetail, Per100, Totals } from "./types";

export const ZERO: Totals = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 };

export function scale(per100: Per100, grams: number): Totals {
  const f = Math.max(0, grams) / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    fat: per100.fat * f,
    carbs: per100.carbs * f,
    fiber: (per100.fiber ?? 0) * f,
    sugar: (per100.sugar ?? 0) * f,
    sodium: (per100.sodium ?? 0) * f,
  };
}

export function add(a: Totals, b: Totals): Totals {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    fiber: a.fiber + b.fiber,
    sugar: a.sugar + b.sugar,
    sodium: a.sodium + b.sodium,
  };
}

/** Gramos y valores de lo que se está eligiendo (igual que computeEntry del servidor). */
export function previewAmount(food: FoodDetail, choice: AmountChoice): { grams: number; totals: Totals } {
  const q = Math.max(0, choice.quantity);
  if (food.parts.length > 0) {
    const chosen = new Map((choice.parts ?? []).map((p) => [p.partId, p]));
    let grams = 0;
    let totals = ZERO;
    for (const part of food.parts) {
      const c = chosen.get(part.id);
      if (c && !c.included) continue;
      const g = (c?.grams ?? part.grams) * q;
      grams += g;
      totals = add(totals, scale(part.per100, g));
    }
    return { grams, totals };
  }
  const portion = choice.portionId ? food.portions.find((p) => p.id === choice.portionId) : undefined;
  const grams = portion ? portion.grams * q : (choice.grams ?? 100);
  return { grams, totals: scale(food.per100, grams) };
}

const nf0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** 1437 → «1.437». */
export const kcalText = (n: number) => nf0.format(Math.round(n));
/** Entero con separador de miles (gramos del resumen del día, donde no cabe el decimal). */
export const intText = (n: number) => nf0.format(Math.round(n));
/** 12.46 → «12,5». */
export const gramsText = (n: number) => nf1.format(Math.round(n * 10) / 10);

/** 1 → «1», 0.5 → «½», 1.5 → «1½», 0.25 → «0,25». */
export function quantityText(q: number): string {
  const whole = Math.floor(q + 1e-9);
  const frac = q - whole;
  if (Math.abs(frac - 0.5) < 0.01) return whole === 0 ? "½" : `${whole}½`;
  if (frac < 0.01) return String(whole);
  return nf1.format(Math.round(q * 100) / 100);
}

/** Lo que falta para la meta (negativo si se pasó). */
export function remaining(target: number, eaten: number): number {
  return Math.round(target - eaten);
}
