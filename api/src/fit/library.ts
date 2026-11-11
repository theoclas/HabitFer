import { createHash } from 'node:crypto';
import { COOLDOWN, WARMUP } from './data/blocks';
import { EXERCISES } from './data/exercises';
import { PROGRAMS, type ProgramDef } from './data/programs';
import { READY_ROUTINES } from './data/routines';
import type { ExerciseDef, ReadyItem, ReadyRoutine } from './data/types';
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
export const PROGRAM_BY_KEY: ReadonlyMap<string, ProgramDef> = new Map(PROGRAMS.map((p) => [p.key, p]));
/** Las sesiones de los programas, por su clave («programa--s1-2»). */
export const SESSION_BY_KEY: ReadonlyMap<string, ReadyRoutine> = new Map(PROGRAMS.flatMap((p) => p.sessions.flat().map((s) => [s.key, s] as const)));

/** Una rutina lista o una sesión de programa, por su clave. */
export function resolveReady(key: string | null | undefined): ReadyRoutine | undefined {
  if (!key) return undefined;
  return READY_BY_KEY.get(key) ?? SESSION_BY_KEY.get(key);
}

/** Minutos de una rutina lista (los ejercicios por lado cuentan doble). */
export function readyMinutes(r: ReadyRoutine): number {
  return routineMinutes(
    r.items.map((i) => ({ sets: i.sets, reps: i.reps, seconds: i.seconds, restSeconds: i.rest, perSide: EXERCISE_BY_KEY.get(i.key)?.perSide })),
    r.circuit,
    r.rounds,
  );
}

/** Segundos de un bloque de calentamiento o estiramiento (los ejercicios por lado cuentan doble). */
export function blockSeconds(items: ReadyItem[]): number {
  return items.reduce((s, i) => s + (i.seconds ?? 0) * (EXERCISE_BY_KEY.get(i.key)?.perSide ? 2 : 1) + i.rest, 0);
}

/** Los bloques que el modo guiado agrega solos al principio y al final. */
export const BLOCKS = {
  warmup: { name: 'Calentamiento', items: WARMUP },
  cooldown: { name: 'Estirar', items: COOLDOWN },
} as const;

let cached: { version: string; body: unknown } | null = null;

/** La biblioteca completa (se arma una vez: no cambia mientras la API corre). */
export function library() {
  if (cached) return cached;
  const exercises: ExerciseView[] = EXERCISES.map((e) => ({ ...e, figure: buildFigure(e.figure) }));
  const ready: ReadyView[] = READY_ROUTINES.map((r) => ({ ...r, minutes: readyMinutes(r) }));
  const blocks = {
    warmup: { ...BLOCKS.warmup, minutes: Math.round(blockSeconds(WARMUP) / 60) },
    cooldown: { ...BLOCKS.cooldown, minutes: Math.round(blockSeconds(COOLDOWN) / 60) },
  };
  const programs = PROGRAMS.map((p) => ({
    ...p,
    sessions: p.sessions.map((week) => week.map((r) => ({ ...r, minutes: readyMinutes(r) }))),
  }));
  const body = { exercises, ready, blocks, programs, labels: { focus: FOCUS_LABELS, equipment: EQUIPMENT_LABELS, muscles: MUSCLE_LABELS } };
  const version = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  cached = { version, body: { version, ...body } };
  return cached;
}
