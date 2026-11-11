import { mondayOf, shiftKey } from '../nutrition/progress/days';

/*
 * Cuentas de FerFit, sin base de datos (para probarlas solas): el tiempo de una rutina, qué días cuentan como
 * entrenados y la racha por semanas.
 */

export type TimedItem = { sets: number; reps?: number | null; seconds?: number | null; restSeconds: number; perSide?: boolean };

/** Segundos que toma una repetición, más o menos. */
const SECONDS_PER_REP = 3;
/** Entre un ejercicio y otro (acomodarse). */
const SWITCH_SECONDS = 20;

/** Minutos aproximados de una rutina: series × (trabajo + descanso) y el cambio entre ejercicios. */
export function routineMinutes(items: TimedItem[], circuit: boolean, rounds: number): number {
  if (items.length === 0) return 0;
  const work = (it: TimedItem) => (it.seconds ?? (it.reps ?? 10) * SECONDS_PER_REP) * (it.perSide ? 2 : 1);
  let total = 0;
  if (circuit) {
    // Un circuito: una serie de cada ejercicio, seguidos, y se repite la vuelta.
    const lap = items.reduce((s, it) => s + work(it) + it.restSeconds, 0);
    total = lap * Math.max(1, rounds);
  } else {
    for (const it of items) total += it.sets * work(it) + Math.max(0, it.sets - 1) * it.restSeconds + SWITCH_SECONDS;
  }
  return Math.max(1, Math.round(total / 60));
}

/** Lo que se guarda de cada ejercicio hecho. */
export type WorkoutItem = { key: string; name: string; sets: number; reps: number | null; seconds: number | null; done: boolean };
export type WorkoutLike = { date: string; kind: 'ROUTINE' | 'ACTIVITY'; completed: boolean; items: WorkoutItem[] | null };

/** Un entrenamiento cuenta si se hizo completo, si es una actividad o si se chuleó al menos un ejercicio. */
export function counts(w: WorkoutLike): boolean {
  return w.completed || w.kind === 'ACTIVITY' || (w.items ?? []).some((i) => i.done);
}

export type WeekDay = { date: string; trained: boolean };
export type Streak = {
  goal: number;
  /** Esta semana (lunes a domingo). */
  week: { start: string; days: WeekDay[]; trainedDays: number; met: boolean; left: number };
  /** Semanas seguidas cumpliendo la meta (la de ahora cuenta si ya se cumplió; si no, aún no rompe nada). */
  weeks: number;
  bestWeeks: number;
  totalDays: number;
  monthDays: number;
};

/**
 * La racha por semanas: una semana se cumple con `goal` días entrenados. Los días de descanso no rompen nada; solo
 * rompe una semana ya terminada que no llegó a la meta.
 */
export function streakOf(trainedDates: Iterable<string>, goal: number, today: string): Streak {
  const days = new Set(trainedDates);
  const perWeek = new Map<string, number>();
  for (const d of days) {
    if (d > today) continue;
    const w = mondayOf(d);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const met = (w: string) => (perWeek.get(w) ?? 0) >= goal;
  const thisWeek = mondayOf(today);

  let weeks = 0;
  for (let w = met(thisWeek) ? thisWeek : shiftKey(thisWeek, -7); met(w); w = shiftKey(w, -7)) weeks++;

  let bestWeeks = 0;
  const all = [...perWeek.keys()].sort();
  if (all.length) {
    let run = 0;
    for (let w = all[0]; w <= thisWeek; w = shiftKey(w, 7)) {
      run = met(w) ? run + 1 : 0;
      bestWeeks = Math.max(bestWeeks, run);
    }
  }

  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = shiftKey(thisWeek, i);
    return { date, trained: days.has(date) };
  });
  const trainedDays = perWeek.get(thisWeek) ?? 0;
  const month = today.slice(0, 7);
  return {
    goal,
    week: { start: thisWeek, days: weekDays, trainedDays, met: trainedDays >= goal, left: Math.max(0, goal - trainedDays) },
    weeks,
    bestWeeks,
    totalDays: [...days].filter((d) => d <= today).length,
    monthDays: [...days].filter((d) => d <= today && d.startsWith(month)).length,
  };
}
