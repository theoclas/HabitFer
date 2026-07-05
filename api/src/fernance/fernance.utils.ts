import { Decimal } from '@prisma/client/runtime/library';
import { addDays, parseDateKey, toDateKey } from '../common/date.utils';

export function decimalToNumber(value: Decimal | number | string | { toString(): string }): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number(value.toString());
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export type InstallmentDraft = { dueDate: Date; amount: number };

export function generateInstallmentDrafts(
  totalAmount: number,
  installmentAmount: number,
  firstDueDate: Date,
): InstallmentDraft[] {
  const count = Math.max(1, Math.ceil(totalAmount / installmentAmount));
  const drafts: InstallmentDraft[] = [];
  let remaining = roundMoney(totalAmount);

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const amount = isLast ? remaining : roundMoney(Math.min(installmentAmount, remaining));
    remaining = roundMoney(remaining - amount);
    drafts.push({ dueDate: addMonths(firstDueDate, i), amount });
    if (remaining <= 0) break;
  }

  return drafts;
}

export function monthStartKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function monthEndKey(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return { from: monthStartKey(y, m), to: monthEndKey(y, m) };
}

export function isDateInRange(key: string, from: string, to: string): boolean {
  return key >= from && key <= to;
}

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseRange(from?: string, to?: string): { from: string; to: string } {
  if (from && to) return { from, to };
  return currentMonthRange();
}
