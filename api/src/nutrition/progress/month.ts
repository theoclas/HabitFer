import { normalize } from '../search.utils';
import { mondayOf, shiftKey } from './days';
import { IN_TARGET_SHARE, type ReportDay, type SummaryTargets } from './report';
import type { TrendPoint } from './trend';

/** «Tu mes en comida»: lo que se repite, los días en meta y la mejor semana. */

export type MonthEntry = { date: string; foodId: string | null; name: string; kcal: number; isDish: boolean };

export type MonthInput = {
  month: string;
  /** Los días del mes hasta hoy. */
  days: ReportDay[];
  entries: MonthEntry[];
  targets: SummaryTargets | null;
  /** Tendencia del peso (de antes y durante el mes). */
  trend: TrendPoint[];
  /** Agua de cada día y la meta. */
  water: { date: string; ml: number }[];
  waterGoalMl: number;
  /** Ayunos que llegaron a su meta en el mes y el más largo (horas). */
  fastsReached: number;
  longestFastHours: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function monthSummary(input: MonthInput) {
  const { days, targets } = input;
  const logged = days.filter((d) => d.entries > 0);
  const inTarget = (d: ReportDay) => !!targets && d.entries > 0 && Math.abs(d.kcal - targets.kcal) <= targets.kcal * IN_TARGET_SHARE;

  // Lo que más se repitió (veces), por alimento o por nombre; y el plato (de la casa o receta) más repetido.
  const count = (list: MonthEntry[]) => {
    const by = new Map<string, { name: string; times: number; kcal: number; days: Set<string> }>();
    for (const e of list) {
      const key = e.foodId ?? `q:${normalize(e.name)}`;
      const cur = by.get(key) ?? { name: e.name, times: 0, kcal: 0, days: new Set<string>() };
      cur.times += 1;
      cur.kcal += e.kcal;
      cur.days.add(e.date);
      by.set(key, cur);
    }
    const best = [...by.values()].sort((a, b) => b.days.size - a.days.size || b.times - a.times || b.kcal - a.kcal)[0];
    return best ? { name: best.name, times: best.times, days: best.days.size, kcal: Math.round(best.kcal) } : null;
  };

  // La mejor semana (lunes a domingo, solo los días del mes): la de más días en meta; empate, la de más días anotados.
  const weeks = new Map<string, ReportDay[]>();
  for (const d of days) {
    const w = mondayOf(d.date);
    weeks.set(w, [...(weeks.get(w) ?? []), d]);
  }
  const ranked = [...weeks.entries()]
    .map(([start, list]) => ({
      start: list[0].date,
      end: list[list.length - 1].date,
      monday: start,
      inTarget: list.filter(inTarget).length,
      logged: list.filter((d) => d.entries > 0).length,
    }))
    .filter((w) => w.logged > 0)
    .sort((a, b) => b.inTarget - a.inTarget || b.logged - a.logged || a.monday.localeCompare(b.monday));
  const bestWeek = targets ? (ranked[0] ?? null) : null;

  // Días seguidos anotando.
  let streak = 0;
  let run = 0;
  for (const d of days) {
    run = d.entries > 0 ? run + 1 : 0;
    streak = Math.max(streak, run);
  }

  // El peso: de la tendencia al empezar el mes (o la primera pesada) a la última del mes.
  const first = input.days[0]?.date;
  const last = input.days[input.days.length - 1]?.date;
  const inMonth = input.trend.filter((p) => first && last && p.date >= first && p.date <= last);
  const before = input.trend.filter((p) => first && p.date < first).pop();
  const startPoint = before ?? inMonth[0];
  const endPoint = inMonth[inMonth.length - 1];
  const weight =
    startPoint && endPoint && endPoint.date !== startPoint.date
      ? { start: r1(startPoint.trend), end: r1(endPoint.trend), change: r1(endPoint.trend - startPoint.trend) }
      : null;

  const waterBy = new Map(input.water.map((w) => [w.date, w.ml]));
  return {
    month: input.month,
    daysInMonth: days.length,
    loggedDays: logged.length,
    entries: input.entries.length,
    avgKcal: logged.length ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length) : null,
    inTarget: targets ? logged.filter(inTarget).length : null,
    proteinDays: targets ? logged.filter((d) => d.protein >= targets.protein * 0.9).length : null,
    waterDays: days.filter((d) => (waterBy.get(d.date) ?? 0) >= input.waterGoalMl).length,
    topFood: count(input.entries),
    topDish: count(input.entries.filter((e) => e.isDish)),
    bestWeek,
    streak,
    weight,
    fasts: { reached: input.fastsReached, longestHours: r1(input.longestFastHours) },
  };
}

/** Los días de un mes «2026-11» (hasta `until`, si el mes no ha terminado). */
export function monthDays(month: string, until: string): { from: string; to: string } {
  const from = `${month}-01`;
  const next = shiftKey(`${month}-28`, 7).slice(0, 7);
  const end = shiftKey(`${next}-01`, -1);
  return { from, to: end < until ? end : until };
}
