import { localDateKey, parseDateKey, toDateKey } from '../../common/date.utils';
import { shiftKey } from './days';

export const MIN_KG = 25;
export const MAX_KG = 350;
const LB = 0.45359237;

/**
 * El peso como lo mande el atajo de iOS: un número (72.5) o un texto («72,5 kg», «72.5», «160 lb»).
 * Si llega una lista (las muestras de Salud), se usa la primera. null si no se entiende o está fuera de rango.
 */
export function parseWeight(value: unknown): number | null {
  const v = Array.isArray(value) ? value[0] : value;
  let kg: number | null = null;
  if (typeof v === 'number') kg = v;
  else if (typeof v === 'string') {
    const m = v
      .trim()
      .toLowerCase()
      .match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilos?|kilogramos?|lb|lbs|libras?)?/);
    if (m) {
      const n = Number(m[1].replace(',', '.'));
      kg = m[2] && /^l/.test(m[2]) ? n * LB : n;
    }
  }
  if (kg == null || !Number.isFinite(kg) || kg < MIN_KG || kg > MAX_KG) return null;
  return Math.round(kg * 100) / 100;
}

/**
 * El día de la pesada: «2026-11-08» o una fecha ISO («2026-11-08T07:02:00-05:00», que se pasa a la hora de
 * Colombia). Sin fecha, con una que no se entiende o en el futuro: hoy. Más de un año atrás: hoy.
 */
export function parseWeighDate(value: unknown, today: string): string {
  let key: string | null = null;
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) key = toDateKey(parseDateKey(s)) === s ? s : null;
    else if (s) {
      const t = Date.parse(s);
      if (Number.isFinite(t)) key = localDateKey(new Date(t));
    }
  }
  if (!key || key > today || key < shiftKey(today, -365)) return today;
  return key;
}
