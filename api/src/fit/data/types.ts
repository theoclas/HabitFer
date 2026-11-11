import type { FigureSpec } from '../figure';

/** Para qué sirve sobre todo. */
export type Focus = 'fuerza' | 'cardio' | 'core' | 'movilidad' | 'estiramiento';
/** Lo que hace falta en casa (vacío = nada). */
export type Equipment = 'silla' | 'pared' | 'colchoneta' | 'mancuernas' | 'banda' | 'escalon';
export type Muscle =
  | 'piernas'
  | 'gluteos'
  | 'pantorrillas'
  | 'pecho'
  | 'espalda'
  | 'hombros'
  | 'biceps'
  | 'triceps'
  | 'abdomen'
  | 'cadera'
  | 'cuello'
  | 'cuerpo';

export type ExerciseDef = {
  /** Clave fija: las rutinas guardan esta clave (no cambiarla nunca). */
  key: string;
  name: string;
  focus: Focus;
  /** 1 principiante, 2 intermedio, 3 avanzado. */
  level: 1 | 2 | 3;
  /** Bajo: sin saltos ni golpes (bueno para articulaciones y para empezar). */
  impact: 'bajo' | 'alto';
  equipment: Equipment[];
  muscles: Muscle[];
  /** Lo que se sugiere por serie: repeticiones o segundos. */
  reps?: number;
  seconds?: number;
  /** Se hace de un lado y luego del otro (las repeticiones son por lado). */
  perSide?: boolean;
  /** Cómo se hace, en pasos cortos. */
  steps: string[];
  /** El error más común o un consejo. */
  tip?: string;
  /** Una versión más fácil o más difícil (por su clave). */
  easier?: string;
  harder?: string;
  figure: FigureSpec;
};

/** Un ejercicio de una rutina lista. */
export type ReadyItem = { key: string; sets: number; reps?: number; seconds?: number; rest: number };

export type ReadyRoutine = {
  key: string;
  name: string;
  /** Una frase de para qué es. */
  summary: string;
  focus: Focus | 'mixta';
  level: 1 | 2 | 3;
  circuit: boolean;
  rounds: number;
  items: ReadyItem[];
};
