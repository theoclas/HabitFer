import { daysBetween, shiftKey } from './days';
import type { WeighIn } from './trend';

/** kcal que hay en un kilo de peso corporal (grasa con algo de agua y músculo). */
export const KCAL_PER_KG = 7700;
/** Días hacia atrás que se miran. */
export const WINDOW_DAYS = 28;
/** Mínimo de días entre la primera y la última pesada de la ventana. */
export const MIN_SPAN_DAYS = 14;
/** Mínimo de pesadas en la ventana. */
export const MIN_WEIGH_INS = 3;
/** Mínimo de días con la comida completa. */
export const MIN_LOGGED_DAYS = 10;
/** La meta no se mueve más de esto por semana. */
export const MAX_WEEKLY_CHANGE = 150;
/** Un día cuenta como completo si lo anotado llega a la mitad del gasto de la fórmula (si no, seguro faltó anotar algo). */
export const COMPLETE_DAY_SHARE = 0.5;

export type DayIntake = { date: string; kcal: number; entries: number };

export type ExpenditureInput = {
  /** Día del cálculo; se usan los días anteriores (hoy aún no termina). */
  today: string;
  intake: DayIntake[];
  weights: WeighIn[];
  /** Gasto con la fórmula (basal × actividad). */
  formulaTdee: number;
  /** El gasto que se usó en la revisión anterior (para no mover la meta más de 150 kcal por semana). */
  previousTdee: number | null;
};

export type Expenditure = {
  status: 'collecting' | 'ready';
  /** Días con la comida completa entre la primera y la última pesada de la ventana. */
  loggedDays: number;
  /** Días entre la primera y la última pesada de la ventana. */
  spanDays: number;
  weighIns: number;
  /** Cuántos días faltan, más o menos, para tener el cálculo. */
  missingDays: number;
  /** Cuántas pesadas más hacen falta en la ventana. */
  needWeighIns: number;
  intakeAvg: number | null;
  /** Cambio del peso en esos días según la recta que mejor pasa por las pesadas (kg). */
  trendChange: number | null;
  /** Gasto observado: ingesta media − 7.700 × kilos por día que cambió el peso. */
  observed: number | null;
  /** Cuánto pesa lo observado frente a la fórmula (0 = solo fórmula, 1 = solo datos): sube con los días medidos. */
  confidence: number;
  formula: number;
  /** El gasto que se usa para la meta. */
  tdee: number;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round10 = (n: number) => Math.round(n / 10) * 10;

/** Pendiente (kg por día) de la recta de mínimos cuadrados por las pesadas: no se deja llevar por un día con mucha agua. */
export function weightSlope(points: WeighIn[]): number | null {
  if (points.length < 2) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => daysBetween(x0, p.date));
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = points.reduce((s, p) => s + p.kg, 0) / points.length;
  let num = 0;
  let den = 0;
  points.forEach((p, i) => {
    num += (xs[i] - mx) * (p.kg - my);
    den += (xs[i] - mx) ** 2;
  });
  return den > 0 ? num / den : null;
}

/**
 * Gasto real con el peso y lo que se come (como MacroFactor, simplificado): en las últimas 4 semanas,
 * ingesta media de los días completos − 7.700 × kilos por día que cambió el peso.
 * Con 2 semanas medidas se mezcla con la fórmula (un tercio) y hacia las 4 semanas cuenta del todo; nunca se
 * mueve más de 150 kcal frente a la revisión anterior.
 */
export function estimateExpenditure(input: ExpenditureInput): Expenditure {
  const formula = Math.round(input.formulaTdee);
  const end = shiftKey(input.today, -1);
  const start = shiftKey(input.today, -WINDOW_DAYS);
  const inWindow = input.weights
    .filter((w) => Number.isFinite(w.kg) && w.kg > 0 && w.date >= start && w.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = inWindow[0] ?? null;
  const last = inWindow[inWindow.length - 1] ?? null;
  const spanDays = first && last ? daysBetween(first.date, last.date) : 0;

  // El peso de una mañana refleja lo comido los días anteriores: se cuentan desde la primera pesada hasta la víspera de la última.
  const threshold = formula * COMPLETE_DAY_SHARE;
  const complete =
    first && last ? input.intake.filter((d) => d.entries > 0 && d.kcal >= threshold && d.date >= first.date && d.date < last.date) : [];
  const loggedDays = complete.length;
  const intakeAvg = loggedDays ? complete.reduce((s, d) => s + d.kcal, 0) / loggedDays : null;
  const slope = weightSlope(inWindow);
  const trendChange = slope == null ? null : Math.round(slope * spanDays * 100) / 100;

  const prev = input.previousTdee ?? formula;
  const limit = (n: number) => round10(clamp(n, prev - MAX_WEEKLY_CHANGE, prev + MAX_WEEKLY_CHANGE));
  const ready =
    spanDays >= MIN_SPAN_DAYS && inWindow.length >= MIN_WEIGH_INS && loggedDays >= MIN_LOGGED_DAYS && loggedDays >= spanDays * 0.5;
  const base = {
    loggedDays,
    spanDays,
    weighIns: inWindow.length,
    needWeighIns: Math.max(0, MIN_WEIGH_INS - inWindow.length),
    intakeAvg: intakeAvg == null ? null : Math.round(intakeAvg),
    trendChange,
    formula,
  };

  if (!ready || intakeAvg == null || slope == null) {
    const missingDays = Math.max(0, MIN_SPAN_DAYS - spanDays, MIN_LOGGED_DAYS - loggedDays, Math.ceil(spanDays * 0.5) - loggedDays);
    return { ...base, status: 'collecting', missingDays, observed: null, confidence: 0, tdee: limit(formula) };
  }
  const observed = clamp(intakeAvg - KCAL_PER_KG * slope, 1000, 6000);
  const confidence = clamp((spanDays - 7) / 21, 0, 1);
  const blended = confidence * observed + (1 - confidence) * formula;
  return {
    ...base,
    status: 'ready',
    missingDays: 0,
    observed: Math.round(observed),
    confidence: Math.round(confidence * 100) / 100,
    tdee: limit(blended),
  };
}
