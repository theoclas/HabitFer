import { daysBetween, mondayOf, shiftKey, weekdayOf } from '../nutrition/progress/days';

/*
 * La semana de FerFit, sin base de datos (para probarla sola): qué rutina toca cada día (el programa si corre, o el
 * plan de la semana), lo que se movió de un día a otro y qué quedó hecho.
 */

/** Una rutina: propia (`routineId`) o lista o de programa (`readyKey`). */
export type Ref = { routineId: string | null; readyKey: string | null };
export const refId = (r: Ref) => (r.routineId ? `r:${r.routineId}` : `l:${r.readyKey ?? ''}`);
export const sameRef = (a: Ref, b: Ref) => refId(a) === refId(b);

/** 0 = lunes … 6 = domingo. */
export const weekdayIndex = (date: string) => weekdayOf(date) - 1;

export type TemplateDay = Ref & { weekday: number };
export type Move = Ref & { id: string; fromDate: string; toDate: string };
/** Un programa empezado: desde el lunes `startDate`, en esos días de la semana; `stoppedOn`: dejado desde ese día. */
export type Run = { programKey: string; startDate: string; weekdays: number[]; stoppedOn: string | null };
export type ProgramShape = { key: string; weeks: number; daysPerWeek: number };

export type Planned = Ref & {
  /** plan: el plan de la semana; program: una sesión del programa; move: pasó de otro día. */
  source: 'plan' | 'program' | 'move';
  movedFrom: string | null;
  moveId: string | null;
  /** Semana del programa (si es una sesión). */
  week: number | null;
};
export type PlanDay = { date: string; items: Planned[] };

/** Semana del programa en esa fecha (1…), o null si ese día el programa no corre. */
export function programWeekOn(run: Run, program: ProgramShape, date: string): number | null {
  const diff = daysBetween(run.startDate, date);
  if (diff < 0) return null;
  if (run.stoppedOn && date >= run.stoppedOn) return null;
  const week = Math.floor(diff / 7) + 1;
  return week <= program.weeks ? week : null;
}

/** El último día del programa (el domingo de su última semana). */
export const programEnd = (run: Run, program: ProgramShape) => shiftKey(run.startDate, program.weeks * 7 - 1);

type Input = {
  template: TemplateDay[];
  /** Los programas empezados, del más nuevo al más viejo (manda el más nuevo que corra ese día). */
  runs: Run[];
  programs: ReadonlyMap<string, ProgramShape>;
  /** Lo movido, en el orden en que se hizo. */
  moves: Move[];
  sessionKey: (program: string, week: number, n: number) => string;
};

/** Lo planeado un día, antes de mover: mientras un programa corre, manda el programa y el plan queda en pausa. */
function basePlanned(date: string, input: Input): Planned[] {
  for (const run of input.runs) {
    const program = input.programs.get(run.programKey);
    if (!program) continue;
    const week = programWeekOn(run, program, date);
    if (week === null) continue;
    const n = run.weekdays.indexOf(weekdayIndex(date));
    if (n < 0 || n >= program.daysPerWeek) return [];
    return [{ routineId: null, readyKey: input.sessionKey(program.key, week, n + 1), source: 'program', movedFrom: null, moveId: null, week }];
  }
  const t = input.template.find((d) => d.weekday === weekdayIndex(date));
  return t ? [{ routineId: t.routineId, readyKey: t.readyKey, source: 'plan', movedFrom: null, moveId: null, week: null }] : [];
}

/** Lo planeado cada día de la semana que empieza el lunes `monday`, con lo que se movió. */
export function weekPlanned(monday: string, input: Input): PlanDay[] {
  const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = shiftKey(monday, i);
    return { date, items: basePlanned(date, input) };
  });
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const m of input.moves) {
    const from = byDate.get(m.fromDate);
    if (from) {
      const k = from.items.findIndex((i) => sameRef(i, m));
      if (k >= 0) from.items.splice(k, 1);
    }
    const to = byDate.get(m.toDate);
    if (to) to.items.push({ routineId: m.routineId, readyKey: m.readyKey, source: 'move', movedFrom: m.fromDate, moveId: m.id, week: null });
  }
  return days;
}

/** Un entreno con rutina que cuenta (para saber qué de lo planeado se hizo). */
export type DoneRef = Ref & { date: string };
export type MatchedDay = { date: string; items: (Planned & { doneOn: string | null })[] };

/**
 * Qué de lo planeado se hizo: con la misma rutina ese día; si no, con la misma rutina hecha un día después en la
 * misma semana (cada entreno cuenta para una sola cosa planeada).
 */
export function matchDone(days: PlanDay[], done: DoneRef[]): MatchedDay[] {
  const pool = done.map((d) => ({ ...d, used: false }));
  const out: MatchedDay[] = days.map((d) => ({ date: d.date, items: d.items.map((i) => ({ ...i, doneOn: null as string | null })) }));
  for (const d of out) {
    for (const it of d.items) {
      const w = pool.find((p) => !p.used && p.date === d.date && sameRef(p, it));
      if (w) {
        w.used = true;
        it.doneOn = d.date;
      }
    }
  }
  for (const d of out) {
    for (const it of d.items) {
      if (it.doneOn) continue;
      const w = pool.find((p) => !p.used && p.date > d.date && sameRef(p, it));
      if (w) {
        w.used = true;
        it.doneOn = w.date;
      }
    }
  }
  return out;
}

export type ItemStatus = 'done' | 'missed' | 'today' | 'upcoming';

export function statusOf(date: string, doneOn: string | null, today: string): ItemStatus {
  if (doneOn) return 'done';
  if (date < today) return 'missed';
  return date === today ? 'today' : 'upcoming';
}

/** Por qué no se puede mover de `from` a `to` (o null si se puede). */
export function moveProblem(from: string, to: string, today: string): string | null {
  if (from === to) return 'Escoge otro día.';
  if (mondayOf(from) !== mondayOf(to)) return 'Solo se puede pasar a otro día de la misma semana.';
  if (to < today) return 'Ese día ya pasó.';
  return null;
}
