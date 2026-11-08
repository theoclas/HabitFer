import { addDays, parseDateKey, toDateKey, toIsoWeekday } from '../../common/date.utils';

/** Fechas como «2026-11-08» (el día de calendario de la persona). */

export const shiftKey = (key: string, days: number) => toDateKey(addDays(parseDateKey(key), days));

/** Días entre dos fechas (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86_400_000);

/** El lunes de la semana de esa fecha. */
export const mondayOf = (key: string) => shiftKey(key, 1 - toIsoWeekday(parseDateKey(key)));

/** 1 = lunes … 7 = domingo. */
export const weekdayOf = (key: string) => toIsoWeekday(parseDateKey(key));

/** Todas las fechas de `from` a `to`, ambas incluidas. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to && out.length < 400; k = shiftKey(k, 1)) out.push(k);
  return out;
}
