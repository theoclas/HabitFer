import type { PriorityRule } from './types';

/**
 * Orden en la búsqueda. El cargador ya sube lo que tiene medidas caseras o sinónimos (lo de todos
 * los días); aquí van los ajustes a mano: lo raro baja para que no tape lo común.
 */
export const PRIORITY: PriorityRule[] = [
  { code: 'F030', priority: 14 }, // el chicharrón de cerdo antes que el de pirarucú
  { code: 'S007', priority: -1 }, // chicharrón de pirarucú
  { code: 'A060', priority: 10 }, // pan blanco antes que otros panes
  { code: 'G013', priority: -6 }, // leche humana
  { code: 'J010', priority: -4 }, // huevo de iguana
  { code: 'J013', priority: -4 }, // huevo de tortuga
  { code: 'J005', priority: -3 }, // huevo en polvo
  { code: 'P082', priority: -3 }, // perico (no los huevos pericos)
  { code: 'F050', priority: -3 }, // iguana
  { code: 'F132', priority: -3 }, // tortuga
  ...['R002', 'R003', 'R004', 'R005', 'R006'].map((code) => ({ code, priority: -2 })), // Bienestarina
  { code: 'G008', priority: -1 }, // leche en polvo
  { code: 'G009', priority: -1 }, // leche evaporada
];
