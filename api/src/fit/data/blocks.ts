import type { ReadyItem } from './types';

/*
 * Calentamiento y estiramiento que el modo guiado agrega solos a cualquier rutina (se pueden quitar).
 * Todo va por tiempo; `rest` es el cambio al siguiente ejercicio. En los ejercicios por lado, los segundos son
 * por cada lado. Cada bloque dura unos 5 minutos.
 */

/** Calentar: movimientos suaves, sin saltos ni equipo. */
export const WARMUP: ReadyItem[] = [
  { key: 'marcha', sets: 1, seconds: 45, rest: 10 },
  { key: 'circulos-brazos', sets: 1, seconds: 30, rest: 10 },
  { key: 'circulos-cadera', sets: 1, seconds: 20, rest: 10 },
  { key: 'apertura-pecho', sets: 1, seconds: 30, rest: 10 },
  { key: 'sentadilla-alcance', sets: 1, seconds: 40, rest: 10 },
  { key: 'paso-lateral', sets: 1, seconds: 40, rest: 0 },
];

/** Estirar al terminar: sostenido y sin rebotes. */
export const COOLDOWN: ReadyItem[] = [
  { key: 'estiramiento-isquios', sets: 1, seconds: 30, rest: 8 },
  { key: 'estiramiento-cuadriceps', sets: 1, seconds: 30, rest: 8 },
  { key: 'estiramiento-hombro', sets: 1, seconds: 20, rest: 8 },
  { key: 'estiramiento-triceps', sets: 1, seconds: 20, rest: 8 },
  { key: 'cobra', sets: 1, seconds: 20, rest: 8 },
  { key: 'nino', sets: 1, seconds: 40, rest: 0 },
];
