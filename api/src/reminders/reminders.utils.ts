export { startOfToday, toDateKey } from '../common/date.utils';

export function startOfMinute(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

export function endOfMinute(date: Date): Date {
  const d = startOfMinute(date);
  d.setMinutes(d.getMinutes() + 1);
  return d;
}

export function formatHHmm(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return h + ':' + m;
}
