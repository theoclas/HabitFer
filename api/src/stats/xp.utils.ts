import { ScheduleType } from '@prisma/client';
import { addDays, parseDateKey, toDateKey } from '../common/date.utils';
import { isScheduledDay } from '../habits/habits.utils';

export const XP_PER_COMPLETION = 10;
export const XP_PERFECT_DAY = 20;

/** Bono por racha larga en el momento de cumplir. */
export function streakBonus(streak: number): number {
  if (streak >= 30) return 5;
  if (streak >= 7) return 3;
  return 0;
}

/**
 * Racha que tenia el habito en cada completado (en orden de fecha).
 * Dos completados encadenan si no hay ningun dia programado sin cumplir entre ellos.
 */
export function runningStreaks(
  scheduleType: ScheduleType,
  scheduleDays: unknown,
  keys: string[],
): { key: string; streak: number }[] {
  const sorted = [...new Set(keys)].sort().filter((k) => isScheduledDay(scheduleType, scheduleDays, parseDateKey(k)));
  const out: { key: string; streak: number }[] = [];
  let prev: string | null = null;
  let current = 0;
  for (const key of sorted) {
    if (prev === null) {
      current = 1;
    } else {
      let d = addDays(parseDateKey(key), -1);
      for (let guard = 0; guard < 8 && !isScheduledDay(scheduleType, scheduleDays, d); guard++) d = addDays(d, -1);
      current = toDateKey(d) === prev ? current + 1 : 1;
    }
    out.push({ key, streak: current });
    prev = key;
  }
  return out;
}

export type XpHabit = { scheduleType: ScheduleType; scheduleDays: unknown; streakEnabled: boolean; keys: string[] };

/** XP total e XP ganada hoy: 10 por habito cumplido, bono por racha y 20 por dia perfecto. */
export function computeXp(habits: XpHabit[], perfectKeys: string[], todayKey: string): { xp: number; todayXp: number } {
  let xp = 0;
  let todayXp = 0;
  for (const h of habits) {
    for (const { key, streak } of runningStreaks(h.scheduleType, h.scheduleDays, h.keys)) {
      const gain = XP_PER_COMPLETION + (h.streakEnabled ? streakBonus(streak) : 0);
      xp += gain;
      if (key === todayKey) todayXp += gain;
    }
  }
  for (const key of perfectKeys) {
    xp += XP_PERFECT_DAY;
    if (key === todayKey) todayXp += XP_PERFECT_DAY;
  }
  return { xp, todayXp };
}

/** XP acumulada necesaria para llegar a un nivel: 0, 100, 300, 600, 1000... */
export function levelStartXp(level: number): number {
  return 50 * (level - 1) * level;
}

export function levelTitle(level: number): string {
  if (level >= 35) return 'Fénix';
  if (level >= 20) return 'Leyenda';
  if (level >= 10) return 'Imparable';
  if (level >= 5) return 'Constante';
  return 'Chispa';
}

export function levelFromXp(xp: number): { level: number; title: string; levelStartXp: number; nextLevelXp: number } {
  let level = 1;
  while (levelStartXp(level + 1) <= xp) level++;
  return { level, title: levelTitle(level), levelStartXp: levelStartXp(level), nextLevelXp: levelStartXp(level + 1) };
}
