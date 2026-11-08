/** Sugerencias del día: lo de siempre en cada comida y la última vez que hubo algo (funciones puras). */

export type Slot = 'DESAYUNO' | 'MEDIAS_NUEVES' | 'ALMUERZO' | 'ONCES' | 'COMIDA';

/** Lo mínimo de una anotación vieja para sugerir. */
export type HistoryItem = {
  id: string;
  /** AAAA-MM-DD. */
  date: string;
  meal: Slot;
  foodId: string | null;
  quick: boolean;
  kcal: number;
  createdAt: Date;
};

export type Habitual<T extends HistoryItem> = { template: T; days: number };

/** «Casi a diario»: en la mitad de los días con algo anotado y en 3 días como mínimo. */
export const HABIT_RULES = { minDays: 3, ratio: 0.5, perMeal: 3 };

const later = (a: HistoryItem, b: HistoryItem) => a.date > b.date || (a.date === b.date && a.createdAt.getTime() > b.createdAt.getTime());

/**
 * Lo que se come casi a diario en cada comida (el tinto del desayuno, la fruta de las medias nueves),
 * con la cantidad de la última vez. `already` es lo que ya está anotado ese día: no se vuelve a proponer.
 */
export function habitualSuggestions<T extends HistoryItem>(
  history: T[],
  already: { meal: Slot; foodId: string | null }[],
  rules = HABIT_RULES,
): Map<Slot, Habitual<T>[]> {
  const activeDays = new Set(history.map((h) => h.date)).size;
  const threshold = Math.max(rules.minDays, Math.ceil(activeDays * rules.ratio));
  const groups = new Map<string, { days: Set<string>; latest: T }>();
  for (const h of history) {
    if (!h.foodId || h.quick) continue;
    const key = `${h.meal}|${h.foodId}`;
    const g = groups.get(key);
    if (!g) groups.set(key, { days: new Set([h.date]), latest: h });
    else {
      g.days.add(h.date);
      if (later(h, g.latest)) g.latest = h;
    }
  }
  const taken = new Set(already.filter((a) => a.foodId).map((a) => `${a.meal}|${a.foodId}`));
  const out = new Map<Slot, Habitual<T>[]>();
  for (const [key, g] of groups) {
    if (g.days.size < threshold || taken.has(key)) continue;
    const list = out.get(g.latest.meal) ?? [];
    list.push({ template: g.latest, days: g.days.size });
    out.set(g.latest.meal, list);
  }
  for (const [meal, list] of out) {
    list.sort((a, b) => b.days - a.days || b.template.createdAt.getTime() - a.template.createdAt.getTime());
    out.set(meal, list.slice(0, rules.perMeal));
  }
  return out;
}

export type PreviousMeal = { date: string; count: number; kcal: number };

/**
 * La última vez que cada comida tuvo algo (para «repetir lo de ayer») y el último día con algo
 * anotado (para repetir el día entero), sin ir más atrás de `sinceKey`.
 */
export function previousMeals(history: HistoryItem[], sinceKey: string): { meals: Map<Slot, PreviousMeal>; day: PreviousMeal | null } {
  const recent = history.filter((h) => h.date >= sinceKey);
  const latest = new Map<Slot, string>();
  let lastDay = '';
  for (const h of recent) {
    const cur = latest.get(h.meal);
    if (!cur || h.date > cur) latest.set(h.meal, h.date);
    if (h.date > lastDay) lastDay = h.date;
  }
  const sum = (items: HistoryItem[]) => Math.round(items.reduce((s, h) => s + h.kcal, 0));
  const meals = new Map<Slot, PreviousMeal>();
  for (const [meal, date] of latest) {
    const items = recent.filter((h) => h.meal === meal && h.date === date);
    meals.set(meal, { date, count: items.length, kcal: sum(items) });
  }
  const dayItems = recent.filter((h) => h.date === lastDay);
  return { meals, day: lastDay ? { date: lastDay, count: dayItems.length, kcal: sum(dayItems) } : null };
}
