import { ScheduleType } from '@prisma/client';
import {
  addDays,
  isSameDay,
  parseDateKey,
  startOfToday,
  toDateKey,
  toIsoWeekday,
} from '../common/date.utils';

export { addDays, isSameDay, parseDateKey, startOfToday, toDateKey, toIsoWeekday } from '../common/date.utils';

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function parseScheduleDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [...ISO_DAYS];
  const days = value.filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 7);
  return days.length ? days : [...ISO_DAYS];
}

export function isScheduledDay(scheduleType: ScheduleType, scheduleDays: unknown, date: Date): boolean {
  if (scheduleType === ScheduleType.DAILY) return true;
  return parseScheduleDays(scheduleDays).includes(toIsoWeekday(date));
}

export function getCurrentStreak(
  scheduleType: ScheduleType,
  scheduleDays: unknown,
  streakEnabled: boolean,
  completionKeys: Set<string>,
  referenceDate: Date = startOfToday(),
): number {
  if (!streakEnabled) return 0;

  let streak = 0;
  let cursor = referenceDate;

  for (let i = 0; i < 400; i++) {
    if (isScheduledDay(scheduleType, scheduleDays, cursor)) {
      const key = toDateKey(cursor);
      if (completionKeys.has(key)) {
        streak++;
      } else if (isSameDay(cursor, referenceDate)) {
        // hoy pendiente, no rompe racha aun
      } else {
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function getLongestStreak(
  scheduleType: ScheduleType,
  scheduleDays: unknown,
  streakEnabled: boolean,
  completionKeys: string[],
): number {
  if (!streakEnabled || completionKeys.length === 0) return 0;

  const sorted = [...new Set(completionKeys)].sort();
  let longest = 0;
  let current = 0;
  let prev: Date | null = null;

  for (const key of sorted) {
    const date = parseDateKey(key);
    if (!isScheduledDay(scheduleType, scheduleDays, date)) continue;

    if (!prev) {
      current = 1;
    } else {
      let expected = addDays(prev, 1);
      let chainOk = false;
      while (!isSameDay(expected, date)) {
        if (isScheduledDay(scheduleType, scheduleDays, expected)) {
          chainOk = false;
          break;
        }
        expected = addDays(expected, 1);
        if (expected > date) break;
      }
      if (isSameDay(expected, date)) chainOk = true;
      current = chainOk ? current + 1 : 1;
    }

    longest = Math.max(longest, current);
    prev = date;
  }

  return longest;
}
