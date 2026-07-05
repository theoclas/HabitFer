/** Calendar date helpers — MySQL DATE / Prisma date-only fields are UTC midnight. */

export function toDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIsoWeekday(date: Date): number {
  const js = date.getUTCDay();
  return js === 0 ? 7 : js;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

/** Local calendar today (fallback when client omits ?date). */
export function localTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfToday(): Date {
  return parseDateKey(localTodayKey());
}

export function dayLabel(date: Date): string {
  const names = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  return names[date.getUTCDay()];
}

export function lastNDays(n: number, ref: Date): Date[] {
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(addDays(ref, -i));
  }
  return days;
}
