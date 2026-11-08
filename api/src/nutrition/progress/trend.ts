import { daysBetween, shiftKey } from './days';

export type WeighIn = { date: string; kg: number };
export type TrendPoint = WeighIn & { trend: number };

/**
 * Suavizado de la tendencia: cada día pesa un 10 % el peso nuevo y un 90 % lo que venía (como Happy Scale
 * o MacroFactor). Así no se mueve con los saltos de un día a otro por agua o sal.
 */
export const TREND_ALPHA = 0.1;

/** Tendencia de cada pesada. Si pasaron n días sin pesarse, el peso nuevo cuenta más: α = 1 − (1 − 0,1)ⁿ. */
export function weightTrend(points: WeighIn[], alpha = TREND_ALPHA): TrendPoint[] {
  const sorted = points.filter((p) => Number.isFinite(p.kg) && p.kg > 0).sort((a, b) => a.date.localeCompare(b.date));
  const out: TrendPoint[] = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ date: p.date, kg: p.kg, trend: p.kg });
      continue;
    }
    const n = Math.max(1, daysBetween(prev.date, p.date));
    const a = 1 - Math.pow(1 - alpha, n);
    out.push({ date: p.date, kg: p.kg, trend: prev.trend + a * (p.kg - prev.trend) });
  }
  return out;
}

/** La tendencia en una fecha: la de la última pesada hasta ese día (null si no hay ninguna antes). */
export function trendAt(points: TrendPoint[], date: string): number | null {
  let found: number | null = null;
  for (const p of points) {
    if (p.date > date) break;
    found = p.trend;
  }
  return found;
}

export type TrendSummary = {
  /** La última pesada. */
  last: TrendPoint;
  /** Cambio de la tendencia en 7 y 30 días (null si no hay pesadas tan atrás). */
  change7: number | null;
  change30: number | null;
  /** Kilos por semana en las últimas 4 semanas (o desde la primera pesada, si son al menos 7 días). */
  weeklyRate: number | null;
};

export function trendSummary(points: TrendPoint[]): TrendSummary | null {
  const last = points[points.length - 1];
  if (!last) return null;
  const change = (days: number) => {
    const before = trendAt(points, shiftKey(last.date, -days));
    return before == null ? null : last.trend - before;
  };
  const back28 = trendAt(points, shiftKey(last.date, -28));
  let weeklyRate: number | null = null;
  if (back28 != null) weeklyRate = (last.trend - back28) / 4;
  else {
    const first = points[0];
    const span = daysBetween(first.date, last.date);
    if (span >= 7) weeklyRate = ((last.trend - first.trend) / span) * 7;
  }
  return { last, change7: change(7), change30: change(30), weeklyRate };
}
