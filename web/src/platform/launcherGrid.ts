// Cómo se acomodan las tarjetas del lanzador de apps: de a dos por fila. Con un número impar de apps, la
// primera (HabitFer) ocupa toda la primera fila, para que no quede un hueco al final.

export const LAUNCHER_COLS = 2;

/** ¿La primera tarjeta va sola, a lo ancho de la fila? */
export function wideFirst(total: number): boolean {
  return total % LAUNCHER_COLS === 1;
}

/** Puestos de la cuadrícula que se ocupan (la tarjeta ancha cuenta por dos). */
function slots(total: number): number {
  return wideFirst(total) ? total + 1 : total;
}

/** Fila y columna de la tarjeta `i` (la ancha está en la fila 0, columna 0). */
function cellOf(i: number, total: number): { row: number; col: number } {
  const slot = wideFirst(total) && i > 0 ? i + 1 : i;
  return { row: Math.floor(slot / LAUNCHER_COLS), col: slot % LAUNCHER_COLS };
}

/** La tarjeta que está en esa fila y columna (en una fila incompleta, la última de la fila). */
function indexAt(row: number, col: number, total: number): number {
  if (!wideFirst(total)) return Math.min(row * LAUNCHER_COLS + col, total - 1);
  return row === 0 ? 0 : Math.min(row * LAUNCHER_COLS + col - 1, total - 1);
}

/** Flecha abajo (+1) o arriba (-1): la tarjeta de la misma columna en la fila de al lado; da la vuelta. */
export function verticalStep(i: number, dir: 1 | -1, total: number): number {
  const rows = Math.ceil(slots(total) / LAUNCHER_COLS);
  const { row, col } = cellOf(i, total);
  return indexAt((row + dir + rows) % rows, col, total);
}
