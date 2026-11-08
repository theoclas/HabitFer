import { HabitKind, ScheduleType } from '@prisma/client';
import { runningStreaks, shiftKey, streakUnit, type StreakUnit } from '../habits/habit-rules';
import { buildDays, byHour, byWeekday, earliestKey, ranking, type HistoryHabit } from './history.utils';
import { computeXp, levelFromXp } from './xp.utils';

/** Resumen de un mes para las tarjetas "tu mes en HabitFer". */
export type MonthSummary = {
  month: string;
  from: string;
  to: string;
  /** El mes ya termino (si no, va hasta hoy). */
  complete: boolean;
  totals: { scheduled: number; completed: number; rate: number; perfectDays: number; activeDays: number; days: number };
  bestDay: { date: string; completed: number } | null;
  bestWeekday: { weekday: number; rate: number } | null;
  bestHour: number | null;
  starHabit: { id: string; title: string; icon: string | null; color: string; rate: number; completed: number } | null;
  topHabits: { id: string; title: string; icon: string | null; color: string; rate: number; completed: number }[];
  longestStreak: { id: string; title: string; icon: string | null; color: string; days: number; unit: StreakUnit } | null;
  xp: number;
  levelStart: number;
  levelEnd: number;
  cleanDays: number;
  moodAverage: number | null;
  previousRate: number | null;
};

export function lastDayOfMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return `${monthKey}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function previousMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function pct(done: number, total: number): number {
  return total ? Math.round((done / total) * 100) : 0;
}

function xpAt(habits: HistoryHabit[], perfectKeys: string[], key: string): number {
  return computeXp(habits, perfectKeys.filter((k) => k <= key), key).xp;
}

/** `monthKey` es YYYY-MM; si es el mes en curso, el resumen va hasta `todayKey`. */
export function monthSummary(habits: HistoryHabit[], moods: Map<string, number>, monthKey: string, todayKey: string): MonthSummary {
  const from = `${monthKey}-01`;
  const end = lastDayOfMonth(monthKey);
  const to = end < todayKey ? end : todayKey;
  const days = buildDays(habits, from, to);
  const scheduled = days.reduce((s, d) => s + d.scheduled, 0);
  const completed = days.reduce((s, d) => s + d.completed, 0);

  const bestDay = days.reduce<{ date: string; completed: number } | null>(
    (best, d) => (d.completed > 0 && (!best || d.completed > best.completed) ? { date: d.date, completed: d.completed } : best),
    null,
  );
  const weekdays = byWeekday(days).filter((r) => r.scheduled >= 2);
  const bestWeekday = weekdays.length ? weekdays.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
  const hours = byHour(habits, from, to);
  const bestHour = hours.reduce((s, x) => s + x, 0) >= 5 ? hours.indexOf(Math.max(...hours)) : null;

  const ranked = ranking(habits, from, to).filter((r) => r.scheduled >= 3 && r.completed > 0);
  const pick = (r: (typeof ranked)[number]) => ({ id: r.id, title: r.title, icon: r.icon, color: r.color, rate: r.rate, completed: r.completed });

  // La racha mas larga que se alcanzo dentro del mes (en dias; las de semanas, aparte).
  let longest: MonthSummary['longestStreak'] = null;
  for (const h of habits) {
    if (h.kind !== HabitKind.BUILD || !h.streakEnabled || h.scheduleType === ScheduleType.WEEKLY_COUNT) continue;
    for (const { key, streak } of runningStreaks(h, to)) {
      if (key < from || key > to) continue;
      if (!longest || streak > longest.days) {
        longest = { id: h.id, title: h.title, icon: h.icon, color: h.color, days: streak, unit: streakUnit(h) };
      }
    }
  }

  // XP ganada en el mes: la del ultimo dia menos la del dia anterior al mes.
  const allDays = buildDays(habits, earliestKey(habits, to), to);
  const perfectKeys = allDays.filter((d) => d.perfect).map((d) => d.date);
  const before = shiftKey(from, -1);
  const xpEnd = xpAt(habits, perfectKeys, to);
  const xpStart = xpAt(habits, perfectKeys, before);

  // Dias limpio de los habitos para dejar (solo dias terminados).
  const lastClosed = to < todayKey ? to : shiftKey(todayKey, -1);
  let cleanDays = 0;
  for (const h of habits) {
    if (h.kind !== HabitKind.QUIT) continue;
    for (let key = from > h.startKey ? from : h.startKey, i = 0; key <= lastClosed && i < 40; key = shiftKey(key, 1), i++) {
      if (!h.doneKeys.has(key)) cleanDays++;
    }
  }

  const monthMoods = [...moods].filter(([k]) => k >= from && k <= to).map(([, v]) => v);
  const prev = previousMonth(monthKey);
  const prevDays = buildDays(habits, `${prev}-01`, lastDayOfMonth(prev));
  const prevScheduled = prevDays.reduce((s, d) => s + d.scheduled, 0);

  return {
    month: monthKey,
    from,
    to,
    complete: end < todayKey,
    totals: {
      scheduled,
      completed,
      rate: pct(completed, scheduled),
      perfectDays: days.filter((d) => d.perfect).length,
      activeDays: days.filter((d) => d.completed > 0).length,
      days: days.length,
    },
    bestDay,
    bestWeekday: bestWeekday ? { weekday: bestWeekday.weekday, rate: bestWeekday.rate } : null,
    bestHour,
    starHabit: ranked[0] ? pick(ranked[0]) : null,
    topHabits: ranked.slice(0, 3).map(pick),
    longestStreak: longest,
    xp: Math.max(0, xpEnd - xpStart),
    levelStart: levelFromXp(xpStart).level,
    levelEnd: levelFromXp(xpEnd).level,
    cleanDays,
    moodAverage: monthMoods.length ? Math.round((monthMoods.reduce((s, x) => s + x, 0) / monthMoods.length) * 10) / 10 : null,
    previousRate: prevScheduled > 0 ? pct(prevDays.reduce((s, d) => s + d.completed, 0), prevScheduled) : null,
  };
}
