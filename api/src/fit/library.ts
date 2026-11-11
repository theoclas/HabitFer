import { createHash } from 'node:crypto';
import { EXERCISES } from './data/exercises';
import { READY_ROUTINES } from './data/routines';
import type { ExerciseDef, ReadyRoutine } from './data/types';
import { routineMinutes } from './fit-math';
import { buildFigure, type Figure } from './figure';

/** Lo que la app recibe de cada ejercicio: el texto y la figura ya calculada. */
export type ExerciseView = Omit<ExerciseDef, 'figure'> & { figure: Figure };
export type ReadyView = ReadyRoutine & { minutes: number };

export const FOCUS_LABELS = { fuerza: 'Fuerza', cardio: 'Cardio', core: 'Abdomen y espalda', movilidad: 'Movilidad', estiramiento: 'Estiramiento', mixta: 'Mixta' } as const;
export const EQUIPMENT_LABELS = { silla: 'Silla', pared: 'Pared', colchoneta: 'Colchoneta', mancuernas: 'Mancuernas', banda: 'Banda elástica', escalon: 'Escalón' } as const;
export const MUSCLE_LABELS = {
  piernas: 'Piernas',
  gluteos: 'Glúteos',
  pantorrillas: 'Pantorrillas',
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombros: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  abdomen: 'Abdomen',
  cadera: 'Cadera',
  cuello: 'Cuello',
  cuerpo: 'Todo el cuerpo',
} as const;

export const EXERCISE_BY_KEY: ReadonlyMap<string, ExerciseDef> = new Map(EXERCISES.map((e) => [e.key, e]));
export const READY_BY_KEY: ReadonlyMap<string, ReadyRoutine> = new Map(READY_ROUTINES.map((r) => [r.key, r]));

/** Minutos de una rutina lista (los ejercicios por lado cuentan doble). */
export function readyMinutes(r: ReadyRoutine): number {
  return routineMinutes(
    r.items.map((i) => ({ sets: i.sets, reps: i.reps, seconds: i.seconds, restSeconds: i.rest, perSide: EXERCISE_BY_KEY.get(i.key)?.perSide })),
    r.circuit,
    r.rounds,
  );
}

let cached: { version: string; body: unknown } | null = null;

/** La biblioteca completa (se arma una vez: no cambia mientras la API corre). */
export function library() {
  if (cached) return cached;
  const exercises: ExerciseView[] = EXERCISES.map((e) => ({ ...e, figure: buildFigure(e.figure) }));
  const ready: ReadyView[] = READY_ROUTINES.map((r) => ({ ...r, minutes: readyMinutes(r) }));
  const body = { exercises, ready, labels: { focus: FOCUS_LABELS, equipment: EQUIPMENT_LABELS, muscles: MUSCLE_LABELS } };
  const version = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  cached = { version, body: { version, ...body } };
  return cached;
}
