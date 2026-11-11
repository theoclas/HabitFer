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

/** Una serie hecha de verdad: repeticiones, segundos y peso (kg), lo que aplique. */
export type SetLog = { reps: number | null; seconds: number | null; weight: number | null };

/** Lo que se guarda de cada ejercicio hecho. `log`: las series reales, si se entrenó con el modo guiado. */
export type WorkoutItem = { key: string; name: string; sets: number; reps: number | null; seconds: number | null; done: boolean; log?: SetLog[] };
export type WorkoutLike = { date: string; kind: 'ROUTINE' | 'ACTIVITY'; completed: boolean; items: WorkoutItem[] | null };

/** Un entrenamiento cuenta si se hizo completo, si es una actividad o si se chuleó al menos un ejercicio. */
export function counts(w: WorkoutLike): boolean {
  return w.completed || w.kind === 'ACTIVITY' || (w.items ?? []).some((i) => i.done);
}

/**
 * Qué queda chuleado. `completed`: todo (o nada si es false y no viene `done`); `done`: exactamente esos;
 * `addDone`: esos se suman a lo que ya estaba (el modo guiado no desmarca lo que se chuleó a mano).
 */
export function markDone(items: WorkoutItem[], opts: { done?: number[]; addDone?: number[]; completed?: boolean }): WorkoutItem[] {
  if (opts.completed) return items.map((i) => ({ ...i, done: true }));
  let out = items;
  if (opts.completed === false && !opts.done) out = out.map((i) => ({ ...i, done: false }));
  if (opts.done) {
    const set = new Set(opts.done);
    out = out.map((it, i) => ({ ...it, done: set.has(i) }));
  }
  if (opts.addDone?.length) {
    const set = new Set(opts.addDone);
    out = out.map((it, i) => (set.has(i) ? { ...it, done: true } : it));
  }
  return out;
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Una serie limpia: enteros para repeticiones y segundos, el peso al medio kilo. */
function cleanSet(s: Partial<SetLog>): SetLog {
  const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  const weight = typeof s.weight === 'number' && Number.isFinite(s.weight) && s.weight > 0 ? roundTo(s.weight, 0.5) : null;
  return { reps: int(s.reps), seconds: int(s.seconds), weight };
}

/** Pone las series reales en cada ejercicio (por su posición). Reemplaza las que tuviera ese ejercicio. */
export function applyLogs(items: WorkoutItem[], logs: { index: number; sets: Partial<SetLog>[] }[] | undefined): WorkoutItem[] {
  if (!logs?.length) return items;
  const byIndex = new Map(logs.filter((l) => l.index >= 0 && l.index < items.length).map((l) => [l.index, l.sets]));
  return items.map((it, i) => {
    const sets = byIndex.get(i);
    return sets ? { ...it, log: sets.slice(0, 20).map(cleanSet) } : it;
  });
}

export type LastLog = { date: string; sets: SetLog[] };

/**
 * La última vez de cada ejercicio con series anotadas. `rows` va del más nuevo al más viejo; si un día tiene
 * varias rutinas con el mismo ejercicio, gana la primera que llegue (la más reciente).
 */
export function lastLogs(rows: { date: string; items: WorkoutItem[] | null }[], keys: string[]): Record<string, LastLog> {
  const wanted = new Set(keys);
  const out: Record<string, LastLog> = {};
  for (const row of rows) {
    for (const it of row.items ?? []) {
      if (!wanted.has(it.key) || out[it.key] || !it.log?.length) continue;
      out[it.key] = { date: row.date, sets: it.log };
    }
    if (Object.keys(out).length === wanted.size) break;
  }
  return out;
}

/** Minutos de un entreno: los anotados; si no hay (se chuleó a mano), los calculados con lo que se hizo. */
export function workoutMinutes(w: { kind: 'ROUTINE' | 'ACTIVITY'; minutes: number | null; items: WorkoutItem[] | null }): number {
  if (w.minutes != null) return w.minutes;
  if (w.kind === 'ACTIVITY') return 0;
  const done = (w.items ?? []).filter((i) => i.done);
  if (!done.length) return 0;
  return routineMinutes(
    done.map((i) => ({ sets: i.sets, reps: i.reps, seconds: i.seconds, restSeconds: 30 })),
    false,
    1,
  );
}

/** La meta de la semana: por días entrenados o por minutos. */
export type GoalKind = 'days' | 'minutes';
export type Goal = { kind: GoalKind; days: number; minutes: number };
/** Un día entrenado y sus minutos (un día puede venir varias veces: se suman). */
export type DayLog = { date: string; minutes: number };

export type WeekDay = { date: string; trained: boolean };
export type Streak = {
  kind: GoalKind;
  /** Meta por días y meta por minutos (se muestra la que diga `kind`). */
  goal: number;
  goalMinutes: number;
  /** Esta semana (lunes a domingo). `left`: días o minutos que faltan, según la meta. */
  week: { start: string; days: WeekDay[]; trainedDays: number; minutes: number; met: boolean; left: number };
  /** Semanas seguidas cumpliendo la meta (la de ahora cuenta si ya se cumplió; si no, aún no rompe nada). */
  weeks: number;
  bestWeeks: number;
  totalDays: number;
  monthDays: number;
};

/** La racha con meta por días (como al principio). */
export function streakOf(trainedDates: Iterable<string>, goal: number, today: string): Streak {
  return streakFor(
    [...trainedDates].map((date) => ({ date, minutes: 0 })),
    { kind: 'days', days: goal, minutes: 0 },
    today,
  );
}

/**
 * La racha por semanas: una semana se cumple con los días (o los minutos) de la meta. Los días de descanso no rompen
 * nada; solo rompe una semana ya terminada que no llegó a la meta.
 */
export function streakFor(logs: DayLog[], goal: Goal, today: string): Streak {
  const minutesByDay = new Map<string, number>();
  for (const l of logs) {
    if (l.date > today) continue;
    minutesByDay.set(l.date, (minutesByDay.get(l.date) ?? 0) + Math.max(0, Math.round(l.minutes)));
  }
  const days = new Set(minutesByDay.keys());
  const perWeek = new Map<string, { days: number; minutes: number }>();
  for (const [d, m] of minutesByDay) {
    const w = mondayOf(d);
    const cur = perWeek.get(w) ?? { days: 0, minutes: 0 };
    perWeek.set(w, { days: cur.days + 1, minutes: cur.minutes + m });
  }
  const met = (w: string) => {
    const v = perWeek.get(w);
    if (!v) return false;
    return goal.kind === 'minutes' ? v.minutes >= goal.minutes : v.days >= goal.days;
  };
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
  const now = perWeek.get(thisWeek) ?? { days: 0, minutes: 0 };
  const left = goal.kind === 'minutes' ? Math.max(0, goal.minutes - now.minutes) : Math.max(0, goal.days - now.days);
  const month = today.slice(0, 7);
  return {
    kind: goal.kind,
    goal: goal.days,
    goalMinutes: goal.minutes,
    week: { start: thisWeek, days: weekDays, trainedDays: now.days, minutes: now.minutes, met: met(thisWeek), left },
    weeks,
    bestWeeks,
    totalDays: [...days].filter((d) => d <= today).length,
    monthDays: [...days].filter((d) => d <= today && d.startsWith(month)).length,
  };
}
