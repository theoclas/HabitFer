import { HabitKind, ScheduleType } from '@prisma/client';
import { localDateKey, parseDateKey, toDateKey, toIsoWeekday } from '../common/date.utils';
import {
  countsOn,
  isDoneOn,
  keysBetween,
  shiftKey,
  weekDoneCount,
  weeklyTargetOf,
  weekStartKey,
  type RuleHabit,
} from '../habits/habit-rules';

/** Una pausa ya pasada a claves: habitId null = todos los habitos. */
export type PauseRange = { id: string; habitId: string | null; startKey: string; endKey: string; note: string | null };

/** Un completado: su dia y, si se marco ese mismo dia, la hora local en que se marco. */
export type HistoryCompletion = { key: string; hour: number | null };

export type HistoryHabit = RuleHabit & {
  id: string;
  title: string;
  icon: string | null;
  color: string;
  goal: number;
  unit: string | null;
  /** Dia (YYYY-MM-DD, hora local) en que se creo el habito. */
  createdKey: string;
  /** Completados (vacio en los habitos para dejar). */
  completions: HistoryCompletion[];
};

type PrismaHabitForHistory = {
  id: string;
  title: string;
  icon: string | null;
  color: string;
  kind: HabitKind;
  scheduleType: ScheduleType;
  scheduleDays: unknown;
  weeklyTarget: number | null;
  streakEnabled: boolean;
  goal: number;
  unit: string | null;
  startDate: Date | null;
  createdAt: Date;
  completions: { date: Date; createdAt: Date }[];
  relapses?: { date: Date }[];
  freezes?: { date: Date }[];
};

/** Dias de pausa de un habito: las suyas y las de todos. Cada pausa con tope de 120 dias. */
export function pauseKeysFor(habitId: string, pauses: PauseRange[]): string[] {
  const out: string[] = [];
  for (const p of pauses) {
    if (p.habitId === null || p.habitId === habitId) out.push(...keysBetween(p.startKey, p.endKey, 120));
  }
  return out;
}

/** La pausa (propia o de todos) que cubre ese dia, si hay. */
export function pauseOn(habitId: string, pauses: PauseRange[], key: string): PauseRange | null {
  return pauses.find((p) => (p.habitId === null || p.habitId === habitId) && p.startKey <= key && key <= p.endKey) ?? null;
}

/**
 * Pasa un habito de Prisma al historial con sus reglas. En BUILD el inicio es el dia de creacion
 * (o el primer completado si es anterior: se puede marcar "ayer" un habito creado hoy).
 * En QUIT el inicio es el primer dia limpio y los doneKeys son las recaidas.
 */
export function toHistoryHabit(h: PrismaHabitForHistory, pauses: PauseRange[] = []): HistoryHabit {
  const isQuit = h.kind === HabitKind.QUIT;
  const completions = isQuit
    ? []
    : h.completions.map((c) => {
        const key = toDateKey(c.date);
        return { key, hour: localDateKey(c.createdAt) === key ? c.createdAt.getHours() : null };
      });
  const firstDone = completions.reduce<string | null>((min, c) => (min === null || c.key < min ? c.key : min), null);
  const createdKey = localDateKey(h.createdAt);
  const startKey = isQuit
    ? h.startDate
      ? toDateKey(h.startDate)
      : createdKey
    : firstDone && firstDone < createdKey
      ? firstDone
      : createdKey;
  return {
    id: h.id,
    title: h.title,
    icon: h.icon,
    color: h.color,
    kind: h.kind,
    scheduleType: h.scheduleType,
    scheduleDays: h.scheduleDays,
    weeklyTarget: h.weeklyTarget,
    streakEnabled: h.streakEnabled,
    goal: h.goal,
    unit: h.unit,
    createdKey,
    startKey,
    completions,
    doneKeys: new Set(isQuit ? (h.relapses ?? []).map((r) => toDateKey(r.date)) : completions.map((c) => c.key)),
    skipKeys: new Set([...(h.freezes ?? []).map((f) => toDateKey(f.date)), ...pauseKeysFor(h.id, pauses)]),
  };
}

/** Primer dia con algo que mostrar (o el `fallback` si no hay habitos para hacer). */
export function earliestKey(habits: HistoryHabit[], fallback: string): string {
  return habits.reduce((min, h) => (h.kind === HabitKind.BUILD && h.startKey < min ? h.startKey : min), fallback);
}

export type DayRow = {
  date: string;
  scheduled: number;
  completed: number;
  /** 0 a 100. */
  rate: number;
  /** Todo lo que contaba ese dia se cumplio. */
  perfect: boolean;
};

const MAX_SPAN_DAYS = 1500;

/** Dias entre dos claves, ambos incluidos (con tope para no recorrer rangos absurdos). */
export function eachDayKey(fromKey: string, toKey: string): string[] {
  return keysBetween(fromKey, toKey, MAX_SPAN_DAYS);
}

/**
 * Totales por dia. Cuenta lo que se pedia ese dia mas lo flexible que si se hizo (X veces por
 * semana). Los habitos para dejar no cuentan, salvo `quitAsClean` (el historial de uno solo):
 * ahi cada dia desde el inicio cuenta, y se cumple si no hubo recaida.
 */
export function buildDays(habits: HistoryHabit[], fromKey: string, toKey: string, opts: { quitAsClean?: boolean } = {}): DayRow[] {
  return eachDayKey(fromKey, toKey).map((key) => {
    let scheduled = 0;
    let completed = 0;
    for (const h of habits) {
      if (h.kind === HabitKind.QUIT) {
        if (!opts.quitAsClean || key < h.startKey) continue;
        scheduled++;
        if (!h.doneKeys.has(key)) completed++;
        continue;
      }
      if (!countsOn(h, key)) continue;
      scheduled++;
      if (isDoneOn(h, key)) completed++;
    }
    return {
      date: key,
      scheduled,
      completed,
      rate: scheduled ? Math.round((completed / scheduled) * 100) : 0,
      perfect: scheduled > 0 && completed === scheduled,
    };
  });
}

export type WeekdayRow = { weekday: number; scheduled: number; completed: number; rate: number };

/** Cumplimiento por dia de la semana (1 = lunes ... 7 = domingo). */
export function byWeekday(days: DayRow[]): WeekdayRow[] {
  const acc: WeekdayRow[] = Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, scheduled: 0, completed: 0, rate: 0 }));
  for (const d of days) {
    const row = acc[toIsoWeekday(parseDateKey(d.date)) - 1];
    row.scheduled += d.scheduled;
    row.completed += d.completed;
  }
  for (const row of acc) row.rate = row.scheduled ? Math.round((row.completed / row.scheduled) * 100) : 0;
  return acc;
}

/** Cuantas veces se marco un habito en cada hora del dia (solo marcados el mismo dia). */
export function byHour(habits: HistoryHabit[], fromKey: string, toKey: string): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const h of habits) {
    for (const c of h.completions) {
      if (c.hour !== null && c.key >= fromKey && c.key <= toKey) hours[c.hour]++;
    }
  }
  return hours;
}

export type RankingRow = {
  id: string;
  title: string;
  icon: string | null;
  color: string;
  streakEnabled: boolean;
  scheduled: number;
  completed: number;
  rate: number;
};

/**
 * "X veces por semana" se mide por semanas: cada semana completa dentro del rango pide su meta;
 * la semana en curso, las cortadas por el rango o el inicio y las que tuvieron pausa solo suman
 * lo hecho (no castigan).
 */
function weeklyTotals(h: HistoryHabit, fromKey: string, toKey: string): { scheduled: number; completed: number } {
  const target = weeklyTargetOf(h);
  const from = h.startKey > fromKey ? h.startKey : fromKey;
  let scheduled = 0;
  let completed = 0;
  for (let ws = weekStartKey(from); ws <= toKey; ws = shiftKey(ws, 7)) {
    const we = shiftKey(ws, 6);
    let done = 0;
    let paused = false;
    for (const key of keysBetween(ws > from ? ws : from, we < toKey ? we : toKey, 7)) {
      if (h.doneKeys.has(key)) done++;
      if (h.skipKeys.has(key)) paused = true;
    }
    const whole = ws >= from && we <= toKey && !paused;
    const counted = Math.min(done, target);
    scheduled += whole ? target : counted;
    completed += counted;
  }
  return { scheduled, completed };
}

/** Habitos para hacer ordenados por cumplimiento en el rango (y por cantidad si empatan). */
export function ranking(habits: HistoryHabit[], fromKey: string, toKey: string): RankingRow[] {
  const keys = eachDayKey(fromKey, toKey);
  return habits
    .filter((h) => h.kind === HabitKind.BUILD)
    .map((h) => {
      let scheduled = 0;
      let completed = 0;
      if (h.scheduleType === ScheduleType.WEEKLY_COUNT) {
        ({ scheduled, completed } = weeklyTotals(h, fromKey, toKey));
      } else {
        for (const key of keys) {
          if (!countsOn(h, key)) continue;
          scheduled++;
          if (isDoneOn(h, key)) completed++;
        }
      }
      return {
        id: h.id,
        title: h.title,
        icon: h.icon,
        color: h.color,
        streakEnabled: h.streakEnabled,
        scheduled,
        completed,
        rate: scheduled ? Math.round((completed / scheduled) * 100) : 0,
      };
    })
    .sort((a, b) => b.rate - a.rate || b.completed - a.completed);
}

/** Veces hechas en la semana de ese dia (para X veces por semana). */
export function weekProgress(h: HistoryHabit, refKey: string): { done: number; target: number } {
  return { done: weekDoneCount(h, weekStartKey(refKey), refKey), target: weeklyTargetOf(h) };
}

export type MoodSummary = {
  entries: number;
  average: number | null;
  /** Cumplimiento promedio en dias de animo 4 o 5. */
  highRate: number | null;
  /** Cumplimiento promedio en dias de animo 1 o 2. */
  lowRate: number | null;
};

export function moodSummary(days: DayRow[], moods: Map<string, number>): MoodSummary {
  const values = [...moods.values()];
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const high: number[] = [];
  const low: number[] = [];
  for (const d of days) {
    const m = moods.get(d.date);
    if (m === undefined || d.scheduled === 0) continue;
    if (m >= 4) high.push(d.rate);
    if (m <= 2) low.push(d.rate);
  }
  return {
    entries: values.length,
    average: values.length ? Math.round((values.reduce((s, x) => s + x, 0) / values.length) * 10) / 10 : null,
    highRate: avg(high),
    lowRate: avg(low),
  };
}
