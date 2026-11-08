import { localDateKey } from '../../common/date.utils';
import { shiftKey } from '../progress/days';

/** Planes de ayuno: horas de ayuno (16 = 16:8, 23 = una comida al día). */
export const FAST_PLANS = [12, 14, 16, 18, 20, 23] as const;
export const MIN_GOAL_HOURS = 10;
export const MAX_GOAL_HOURS = 72;
const HOUR = 3_600_000;

export type FastRow = { id: string; startedAt: Date; endedAt: Date | null; goalHours: number };

/** Cuánto lleva o duró y si llegó a la meta. */
export function fastState(f: FastRow, now: Date) {
  const end = f.endedAt ?? now;
  const elapsedMs = Math.max(0, end.getTime() - f.startedAt.getTime());
  const goalMs = f.goalHours * HOUR;
  return {
    elapsedMs,
    goalMs,
    reached: elapsedMs >= goalMs,
    /** Cuándo llega (o llegó) a la meta. */
    goalAt: new Date(f.startedAt.getTime() + goalMs),
    hours: elapsedMs / HOUR,
  };
}

/** El día (en Colombia) en que cuenta un ayuno: el día en que terminó o, si sigue, hoy. */
export const fastDay = (f: FastRow, now: Date) => localDateKey(f.endedAt ?? now);

/** Horas del ayuno más largo que llegó a su meta, por día. */
export function reachedByDay(fasts: FastRow[], now: Date): Map<string, number> {
  const by = new Map<string, number>();
  for (const f of fasts) {
    const s = fastState(f, now);
    if (!s.reached) continue;
    const key = fastDay(f, now);
    by.set(key, Math.max(by.get(key) ?? 0, s.hours));
  }
  return by;
}

/**
 * Racha: días seguidos con un ayuno que llegó a su meta. Si hoy aún no hay, cuenta desde ayer (el día no ha
 * terminado). La mejor racha mira todo el historial.
 */
export function fastStreaks(fasts: FastRow[], now: Date): { current: number; best: number } {
  const days = reachedByDay(fasts, now);
  const today = localDateKey(now);
  let current = 0;
  for (let k = days.has(today) ? today : shiftKey(today, -1); days.has(k); k = shiftKey(k, -1)) current++;
  const sorted = [...days.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    run = prev && shiftKey(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best };
}
