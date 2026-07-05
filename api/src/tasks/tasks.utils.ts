import { parseDateKey, startOfToday, toDateKey } from '../common/date.utils';

export { parseDateKey, startOfToday, toDateKey } from '../common/date.utils';

export function startOfDay(date: Date): Date {
  return parseDateKey(toDateKey(date));
}

export function isOverdue(dueDate: Date | null, status: string, ref = startOfToday()): boolean {
  if (!dueDate || status === 'DONE') return false;
  return toDateKey(dueDate) < toDateKey(ref);
}

export function isDueToday(dueDate: Date | null, ref = startOfToday()): boolean {
  if (!dueDate) return false;
  return toDateKey(dueDate) === toDateKey(ref);
}

export function computeReminderAt(
  reminderEnabled: boolean,
  dueDate: string | null | undefined,
  dueTime: string | null | undefined,
): Date | null {
  if (!reminderEnabled || !dueDate) return null;
  const [y, m, d] = dueDate.split('-').map(Number);
  const [hh, mm] = (dueTime ?? '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
