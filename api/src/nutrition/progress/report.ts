import type { MealSlot } from '@prisma/client';
import { MEAL_ORDER } from '../meals';
import { normalize } from '../search.utils';
import { eachDay } from './days';

/** Lo que hace falta de cada anotación para el informe. */
export type ReportEntry = {
  date: string;
  meal: MealSlot;
  foodId: string | null;
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
};

export type ReportDay = {
  date: string;
  entries: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar: number;
  sodium: number;
  /** kcal de cada comida. */
  meals: Record<MealSlot, number>;
  /** Proteína del desayuno (para los descubrimientos). */
  breakfastProtein: number;
};

const emptyMeals = (): Record<MealSlot, number> => ({ DESAYUNO: 0, MEDIAS_NUEVES: 0, ALMUERZO: 0, ONCES: 0, COMIDA: 0 });
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Un día por fecha (también los vacíos), con sus sumas y las kcal de cada comida. */
export function buildDays(entries: ReportEntry[], from: string, to: string): ReportDay[] {
  const by = new Map<string, ReportDay>();
  for (const date of eachDay(from, to)) {
    by.set(date, { date, entries: 0, kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0, meals: emptyMeals(), breakfastProtein: 0 });
  }
  for (const e of entries) {
    const d = by.get(e.date);
    if (!d) continue;
    d.entries += 1;
    d.kcal += e.kcal;
    d.protein += e.protein;
    d.fat += e.fat;
    d.carbs += e.carbs;
    d.fiber += e.fiber ?? 0;
    d.sugar += e.sugar ?? 0;
    d.sodium += e.sodium ?? 0;
    d.meals[e.meal] += e.kcal;
    if (e.meal === 'DESAYUNO') d.breakfastProtein += e.protein;
  }
  return [...by.values()].map((d) => ({
    ...d,
    kcal: Math.round(d.kcal),
    protein: r1(d.protein),
    fat: r1(d.fat),
    carbs: r1(d.carbs),
    fiber: r1(d.fiber),
    sugar: r1(d.sugar),
    sodium: Math.round(d.sodium),
    meals: Object.fromEntries(MEAL_ORDER.map((m) => [m, Math.round(d.meals[m])])) as Record<MealSlot, number>,
    breakfastProtein: r1(d.breakfastProtein),
  }));
}

export type SummaryTargets = { kcal: number; protein: number; fiber: number; sugar: number; sodium: number };

export type ReportSummary = {
  /** Días con algo anotado. */
  logged: number;
  /** Promedios de los días anotados (null si no hay ninguno). */
  avg: { kcal: number; protein: number; fat: number; carbs: number; fiber: number; sugar: number; sodium: number } | null;
  /** Días anotados a menos de un 10 % de la meta de calorías (null sin meta). */
  inTarget: number | null;
  /** Días anotados con al menos el 90 % de la proteína (null sin meta). */
  proteinDays: number | null;
  /** Días anotados por encima del límite de sodio. */
  sodiumOver: number | null;
};

/** Margen para contar un día «en la meta». */
export const IN_TARGET_SHARE = 0.1;

export function summarize(days: ReportDay[], targets: SummaryTargets | null): ReportSummary {
  const logged = days.filter((d) => d.entries > 0);
  if (logged.length === 0) return { logged: 0, avg: null, inTarget: targets ? 0 : null, proteinDays: targets ? 0 : null, sodiumOver: targets ? 0 : null };
  const mean = (pick: (d: ReportDay) => number) => logged.reduce((s, d) => s + pick(d), 0) / logged.length;
  return {
    logged: logged.length,
    avg: {
      kcal: Math.round(mean((d) => d.kcal)),
      protein: r1(mean((d) => d.protein)),
      fat: r1(mean((d) => d.fat)),
      carbs: r1(mean((d) => d.carbs)),
      fiber: r1(mean((d) => d.fiber)),
      sugar: r1(mean((d) => d.sugar)),
      sodium: Math.round(mean((d) => d.sodium)),
    },
    inTarget: targets ? logged.filter((d) => Math.abs(d.kcal - targets.kcal) <= targets.kcal * IN_TARGET_SHARE).length : null,
    proteinDays: targets ? logged.filter((d) => d.protein >= targets.protein * 0.9).length : null,
    sodiumOver: targets ? logged.filter((d) => d.sodium > targets.sodium).length : null,
  };
}

export type MealShare = { slot: MealSlot; kcal: number; share: number };

/** Cuánto pesa cada comida en lo comido del periodo. */
export function mealShares(days: ReportDay[]): MealShare[] {
  const totals = emptyMeals();
  for (const d of days) for (const m of MEAL_ORDER) totals[m] += d.meals[m];
  const all = MEAL_ORDER.reduce((s, m) => s + totals[m], 0);
  return MEAL_ORDER.map((slot) => ({ slot, kcal: Math.round(totals[slot]), share: all > 0 ? Math.round((totals[slot] / all) * 1000) / 1000 : 0 }));
}

export type TopFood = { foodId: string | null; name: string; kcal: number; times: number; share: number };

/** Lo que más calorías aportó: por alimento (o por nombre en los registros rápidos). */
export function topFoods(entries: ReportEntry[], limit = 6): TopFood[] {
  const by = new Map<string, TopFood>();
  let all = 0;
  for (const e of entries) {
    all += e.kcal;
    const key = e.foodId ?? `q:${normalize(e.name)}`;
    const cur = by.get(key) ?? { foodId: e.foodId, name: e.name, kcal: 0, times: 0, share: 0 };
    cur.kcal += e.kcal;
    cur.times += 1;
    by.set(key, cur);
  }
  return [...by.values()]
    .filter((f) => f.kcal > 0)
    .sort((a, b) => b.kcal - a.kcal || b.times - a.times)
    .slice(0, limit)
    .map((f) => ({ ...f, kcal: Math.round(f.kcal), share: all > 0 ? Math.round((f.kcal / all) * 1000) / 1000 : 0 }));
}
