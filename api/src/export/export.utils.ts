/** Utilidades puras del respaldo: CSV y validacion de fechas del archivo. */

export const BACKUP_APP = 'HabitFer';
export const BACKUP_VERSION = 1;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Una celda de CSV: entre comillas si lleva coma, comillas o salto de linea. */
export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con BOM (para que Excel lea bien las tildes) y saltos de linea de Windows. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Clave de fecha valida (YYYY-MM-DD real) y no posterior a `maxKey`. */
export function validDateKey(value: unknown, maxKey: string): string | null {
  if (typeof value !== 'string' || !DATE_KEY.test(value) || value > maxKey) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? value : null;
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s.slice(0, max) : null;
}

export function normTitle(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}
