import { BadRequestException } from '@nestjs/common';
import { localTodayKey } from '../common/date.utils';

/** Lo más grande que cabe en DECIMAL(14,2): un billón de pesos menos uno. */
export const MAX_AMOUNT = 999_999_999_999;
/** 50 años de cuotas mensuales. */
export const MAX_INSTALLMENTS = 600;

export function decimalToNumber(
  value: number | string | { toString(): string } | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number(value.toString());
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Los pesos colombianos no usan centavos. */
export function roundPesos(n: number): number {
  return Math.round(n);
}

/** Días del mes (`monthIndex` empieza en 0). */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** AAAA-MM-DD que existe de verdad en el calendario (el 30 de febrero no). */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_KEY.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo - 1);
}

/**
 * La fecha `months` meses después de `anchor`, el mismo día del mes o el último día si ese mes es más corto:
 * del 31 de enero sale el 28 (o 29) de febrero, y del 31 de octubre el 30 de noviembre.
 */
export function addMonthsClamped(anchor: Date, months: number): Date {
  const first = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1),
  );
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  return new Date(
    Date.UTC(y, m, Math.min(anchor.getUTCDate(), daysInMonth(y, m))),
  );
}

/**
 * Lo que hacía el generador viejo (setUTCMonth): del 31 de octubre saltaba al 1 de diciembre.
 * Solo sirve para reconocer las cuotas que quedaron corridas y corregirlas.
 */
export function legacyAddMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export type InstallmentDraft = { dueDate: Date; amount: number };

/** Cuotas mensuales en pesos enteros: todas de `installmentAmount` y la última con lo que falte. */
export function generateInstallmentDrafts(
  totalAmount: number,
  installmentAmount: number,
  firstDueDate: Date,
): InstallmentDraft[] {
  const total = roundPesos(totalAmount);
  const cuota = roundPesos(installmentAmount);
  if (!(total >= 1) || !(cuota >= 1))
    throw new BadRequestException(
      'El total y la cuota deben ser de al menos $ 1.',
    );
  if (cuota > total)
    throw new BadRequestException('La cuota no puede ser mayor que el total.');
  const count = Math.ceil(total / cuota);
  if (count > MAX_INSTALLMENTS) {
    throw new BadRequestException(
      `Así quedarían ${count} cuotas; el máximo es ${MAX_INSTALLMENTS}. Revisa el total y la cuota.`,
    );
  }
  const drafts: InstallmentDraft[] = [];
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? total - cuota * (count - 1) : cuota;
    drafts.push({ dueDate: addMonthsClamped(firstDueDate, i), amount });
  }
  return drafts;
}

/**
 * Plan nuevo para lo que falta: `count` cuotas mensuales de `amount` desde `firstDueDate`.
 * Si viene `lastAmount`, la última cuota es de ese valor (por ejemplo, la cuota final más pequeña).
 */
export function planDrafts(
  count: number,
  amount: number,
  firstDueDate: Date,
  lastAmount?: number | null,
): InstallmentDraft[] {
  const n = Math.trunc(count);
  const cuota = roundPesos(amount);
  if (!(n >= 1) || n > MAX_INSTALLMENTS)
    throw new BadRequestException(
      `El número de cuotas debe estar entre 1 y ${MAX_INSTALLMENTS}.`,
    );
  if (!(cuota >= 1))
    throw new BadRequestException('La cuota debe ser de al menos $ 1.');
  const last =
    lastAmount === undefined || lastAmount === null
      ? cuota
      : roundPesos(lastAmount);
  if (!(last >= 1))
    throw new BadRequestException('La última cuota debe ser de al menos $ 1.');
  const drafts: InstallmentDraft[] = [];
  for (let i = 0; i < n; i++)
    drafts.push({
      dueDate: addMonthsClamped(firstDueDate, i),
      amount: i === n - 1 ? last : cuota,
    });
  return drafts;
}

/**
 * Cuotas que el generador viejo dejó corridas (si la primera caía el 29, 30 o 31): devuelve las pendientes cuya fecha
 * es exactamente la que daba el cálculo viejo, con la fecha correcta. Las pagadas y las que alguien cambió no se tocan.
 */
export function legacyDateFixes<
  T extends { id: string; dueDate: Date; status: string },
>(installments: T[]): { id: string; dueDate: Date }[] {
  if (installments.length < 2) return [];
  const sorted = [...installments].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
  );
  const anchor = sorted[0].dueDate;
  if (anchor.getUTCDate() <= 28) return [];
  const fixes: { id: string; dueDate: Date }[] = [];
  sorted.forEach((inst, k) => {
    if (k === 0 || inst.status !== 'PENDING') return;
    const legacy = legacyAddMonths(anchor, k);
    const right = addMonthsClamped(anchor, k);
    if (
      inst.dueDate.getTime() === legacy.getTime() &&
      legacy.getTime() !== right.getTime()
    ) {
      fixes.push({ id: inst.id, dueDate: right });
    }
  });
  return fixes;
}

export function monthStartKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function monthEndKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month - 1)).padStart(2, '0')}`;
}

export function currentMonthRange(todayKey: string = localTodayKey()): {
  from: string;
  to: string;
} {
  const [y, m] = todayKey.split('-').map(Number);
  return { from: monthStartKey(y, m), to: monthEndKey(y, m) };
}

/** Rango del resumen: valida las fechas y, si falta una, la completa con el mes de la otra. Sin fechas: este mes. */
export function parseRange(
  from?: string,
  to?: string,
  todayKey: string = localTodayKey(),
): { from: string; to: string } {
  const f = from?.trim() || undefined;
  const t = to?.trim() || undefined;
  if (f !== undefined && !isDateKey(f))
    throw new BadRequestException(
      'La fecha «desde» no es válida (usa AAAA-MM-DD).',
    );
  if (t !== undefined && !isDateKey(t))
    throw new BadRequestException(
      'La fecha «hasta» no es válida (usa AAAA-MM-DD).',
    );
  if (f && t) {
    if (f > t)
      throw new BadRequestException('La fecha «desde» va después de «hasta».');
    return { from: f, to: t };
  }
  if (f) {
    const [y, m] = f.split('-').map(Number);
    return { from: f, to: monthEndKey(y, m) };
  }
  if (t) {
    const [y, m] = t.split('-').map(Number);
    return { from: monthStartKey(y, m), to: t };
  }
  return currentMonthRange(todayKey);
}

export function isDateInRange(key: string, from: string, to: string): boolean {
  return key >= from && key <= to;
}

/** Día (AAAA-MM-DD) de un instante, en la hora local del servidor (America/Bogota en producción). */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Días de `a` a `b` (AAAA-MM-DD): positivo si `b` es después. */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000,
  );
}
