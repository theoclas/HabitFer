import { ScheduleType } from '@prisma/client';
import { addDays, localDateKey, parseDateKey, toDateKey, toIsoWeekday } from '../common/date.utils';
import { isScheduledDay } from '../habits/habits.utils';

type PrismaHabitWithCompletions = {
  id: string;
  title: string;
  icon: string | null;
  color: string;
  scheduleType: ScheduleType;
  scheduleDays: unknown;
  streakEnabled: boolean;
  createdAt: Date;
  completions: { date: Date; createdAt: Date }[];
};

/**
 * Pasa un habito de Prisma al formato del historial. El inicio efectivo es el dia de creacion
 * o el primer completado si es anterior (se puede marcar "ayer" un habito creado hoy).
 */
export function toHistoryHabit(h: PrismaHabitWithCompletions): HistoryHabit {
  const completions = h.completions.map((c) => {
    const key = toDateKey(c.date);
    return { key, hour: localDateKey(c.createdAt) === key ? c.createdAt.getHours() : null };
  });
  const firstDone = completions.reduce<string | null>((min, c) => (min === null || c.key < min ? c.key : min), null);
  const createdKey = localDateKey(h.createdAt);
  return {
    id: h.id,
    title: h.title,
    icon: h.icon,
    color: h.color,
    scheduleType: h.scheduleType,
    scheduleDays: h.scheduleDays,
    streakEnabled: h.streakEnabled,
    createdKey: firstDone && firstDone < createdKey ? firstDone : createdKey,
    completions,
  };
}

/** Primer dia con algo que mostrar (o hoy si no hay habitos). */
export function earliestKey(habits: HistoryHabit[], fallback: string): string {
  return habits.reduce((min, h) => (h.createdKey < min ? h.createdKey : min), fallback);
}

/** Un completado: su dia y, si se marco ese mismo dia, la hora local en que se marco. */
export type HistoryCompletion = { key: string; hour: number | null };

export type HistoryHabit = {
  id: string;
  title: string;
  icon: string | null;
  color: string;
  scheduleType: ScheduleType;
  scheduleDays: unknown;
  streakEnabled: boolean;
  /** Dia (YYYY-MM-DD, hora local) en que se creo: antes de eso no cuenta como programado. */
  createdKey: string;
  completions: HistoryCompletion[];
};

export type DayRow = {
  date: string;
  scheduled: number;
  completed: number;
  /** 0 a 100. */
  rate: number;
  /** Todos los habitos programados ese dia se cumplieron. */
  perfect: boolean;
};

const MAX_SPAN_DAYS = 1500;

/** Dias entre dos claves, ambos incluidos (con tope para no recorrer rangos absurdos). */
export function eachDayKey(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let cursor = parseDateKey(fromKey);
  for (let i = 0; i < MAX_SPAN_DAYS; i++) {
    const key = toDateKey(cursor);
    if (key > toKey) break;
    out.push(key);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function isScheduledOn(h: Pick<HistoryHabit, 'scheduleType' | 'scheduleDays' | 'createdKey'>, key: string): boolean {
  return h.createdKey <= key && isScheduledDay(h.scheduleType, h.scheduleDays, parseDateKey(key));
}

export function buildDays(habits: HistoryHabit[], fromKey: string, toKey: string): DayRow[] {
  const sets = habits.map((h) => new Set(h.completions.map((c) => c.key)));
  return eachDayKey(fromKey, toKey).map((key) => {
    let scheduled = 0;
    let completed = 0;
    habits.forEach((h, i) => {
      if (!isScheduledOn(h, key)) return;
      scheduled++;
      if (sets[i].has(key)) completed++;
    });
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

/** Habitos ordenados por cumplimiento en el rango (y por cantidad si empatan). */
export function ranking(habits: HistoryHabit[], fromKey: string, toKey: string): RankingRow[] {
  const keys = eachDayKey(fromKey, toKey);
  return habits
    .map((h) => {
      const done = new Set(h.completions.map((c) => c.key));
      let scheduled = 0;
      let completed = 0;
      for (const key of keys) {
        if (!isScheduledOn(h, key)) continue;
        scheduled++;
        if (done.has(key)) completed++;
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
