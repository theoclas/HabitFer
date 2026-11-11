/** Tipos de FerFit (lo que manda la API en /fit). */

export type Pt = [number, number];
export type FigureLine = { d: string; far: boolean };
export type FigureShape = { head: Pt; lines: FigureLine[]; hands: Pt[] };
export type Figure = {
  view: "side" | "front";
  a: FigureShape;
  b: FigureShape | null;
  props: string[];
  weights: boolean;
  band: { a: string; b: string | null } | null;
  dur: number;
};

export type Focus = "fuerza" | "cardio" | "core" | "movilidad" | "estiramiento";
export type Equipment = "silla" | "pared" | "colchoneta" | "mancuernas" | "banda" | "escalon";

export type Exercise = {
  key: string;
  name: string;
  focus: Focus;
  level: 1 | 2 | 3;
  impact: "bajo" | "alto";
  equipment: Equipment[];
  muscles: string[];
  reps?: number;
  seconds?: number;
  perSide?: boolean;
  steps: string[];
  tip?: string;
  easier?: string;
  harder?: string;
  figure: Figure;
};

export type ReadyItem = { key: string; sets: number; reps?: number; seconds?: number; rest: number };
export type ReadyRoutine = {
  key: string;
  name: string;
  summary: string;
  focus: Focus | "mixta";
  level: 1 | 2 | 3;
  circuit: boolean;
  rounds: number;
  items: ReadyItem[];
  minutes: number;
};

/** Calentamiento o estiramiento que el modo guiado agrega solo (todo por tiempo; segundos por lado). */
export type Block = { name: string; minutes: number; items: ReadyItem[] };

export type Library = {
  version: string;
  exercises: Exercise[];
  ready: ReadyRoutine[];
  blocks: { warmup: Block; cooldown: Block };
  labels: {
    focus: Record<string, string>;
    equipment: Record<string, string>;
    muscles: Record<string, string>;
  };
};

export type RoutineItem = { id?: string; exerciseKey: string; sets: number; reps: number | null; seconds: number | null; restSeconds: number };
export type Routine = {
  id: string;
  name: string;
  notes: string | null;
  circuit: boolean;
  rounds: number;
  sourceKey: string | null;
  lastDoneAt: string | null;
  updatedAt: string;
  minutes: number;
  items: RoutineItem[];
};
export type RoutineInput = Pick<Routine, "name" | "notes" | "circuit" | "rounds"> & { items: Omit<RoutineItem, "id">[] };

/** Una serie hecha de verdad: repeticiones, segundos y peso en kg (lo que aplique). */
export type SetLog = { reps: number | null; seconds: number | null; weight: number | null };
export type WorkoutItem = { key: string; name: string; sets: number; reps: number | null; seconds: number | null; done: boolean; log?: SetLog[] };
/** La última vez de cada ejercicio con series anotadas. */
export type History = Record<string, { date: string; sets: SetLog[] }>;
export type Workout = {
  id: string;
  date: string;
  kind: "ROUTINE" | "ACTIVITY";
  routineId: string | null;
  readyKey: string | null;
  name: string;
  activity: string | null;
  minutes: number | null;
  items: WorkoutItem[] | null;
  completed: boolean;
  effort: number | null;
  note: string | null;
  counts: boolean;
};

export type Streak = {
  goal: number;
  week: { start: string; days: { date: string; trained: boolean }[]; trainedDays: number; met: boolean; left: number };
  weeks: number;
  bestWeeks: number;
  totalDays: number;
  monthDays: number;
};

export type Home = {
  today: string;
  date: string;
  streak: Streak;
  workouts: Workout[];
  routines: Routine[];
  activities: { key: string; label: string }[];
};

/** Lo que se le manda a la API al chulear. */
export type WorkoutSave =
  | {
      date: string;
      kind: "ROUTINE";
      routineId?: string;
      readyKey?: string;
      done?: number[];
      completed?: boolean;
      /** Modo guiado: se suman a lo ya chuleado, con sus series reales y los minutos. */
      addDone?: number[];
      logs?: { index: number; sets: SetLog[] }[];
      minutes?: number;
    }
  | { date: string; kind: "ACTIVITY"; activity: string; minutes: number; name?: string };
