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
export type Equipment = "silla" | "pared" | "colchoneta" | "mancuernas" | "banda" | "escalon" | "barra";

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
  /** Enfoques para buscarla (bajo-impacto, fuerza, cardio, abdomen, movilidad, yoga, caminata, estirar). */
  topics?: string[];
  level: 1 | 2 | 3;
  circuit: boolean;
  rounds: number;
  items: ReadyItem[];
  minutes: number;
};

/** Un video de YouTube escogido para un ejercicio o una rutina lista. */
export type CuratedVideo = { id: string; title: string; channel: string; start?: number };

/** Un video que la persona pegó en un ejercicio o en una rutina. */
export type MyVideo = {
  id: string;
  target: "exercise" | "routine";
  key: string;
  videoId: string;
  start: number;
  title: string | null;
  channel: string | null;
};

/** Calentamiento o estiramiento que el modo guiado agrega solo (todo por tiempo; segundos por lado). */
export type Block = { name: string; minutes: number; items: ReadyItem[] };

/** Un programa de varias semanas: sessions[semana - 1][número - 1] son rutinas listas con clave «programa--s1-2». */
export type Program = {
  key: string;
  name: string;
  summary: string;
  level: 1 | 2 | 3;
  focus: Focus | "mixta";
  weeks: number;
  daysPerWeek: number;
  /** Días sugeridos (0 = lunes … 6 = domingo). */
  suggestedDays: number[];
  weekNotes: string[];
  sessions: ReadyRoutine[][];
};

export type Library = {
  version: string;
  exercises: Exercise[];
  ready: ReadyRoutine[];
  blocks: { warmup: Block; cooldown: Block };
  /** Puede faltar en una biblioteca guardada en el teléfono antes de la fase 2. */
  programs?: Program[];
  /** Videos escogidos (desde la fase 3). */
  videos?: { exercises: Record<string, CuratedVideo>; routines: Record<string, CuratedVideo> };
  labels: {
    focus: Record<string, string>;
    equipment: Record<string, string>;
    muscles: Record<string, string>;
    topics?: Record<string, string>;
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

export type GoalKind = "days" | "minutes";

export type Streak = {
  kind: GoalKind;
  /** Meta por días y por minutos (vale la que diga `kind`). */
  goal: number;
  goalMinutes: number;
  /** `left`: días o minutos que faltan esta semana, según la meta. */
  week: { start: string; days: { date: string; trained: boolean }[]; trainedDays: number; minutes: number; met: boolean; left: number };
  weeks: number;
  bestWeeks: number;
  totalDays: number;
  monthDays: number;
};

export type FitSettings = {
  goalKind: GoalKind;
  weeklyGoalDays: number;
  weeklyGoalMinutes: number;
  remindOn: boolean;
  remindAt: string;
  /** Lo que hay en casa; null si no lo ha dicho (se muestra todo). */
  equipment: string[] | null;
};

export type ItemStatus = "done" | "missed" | "today" | "upcoming";

/** Una rutina planeada un día: de dónde viene, cómo va y a dónde lleva. */
export type DayItem = {
  routineId: string | null;
  readyKey: string | null;
  name: string;
  minutes: number;
  exists: boolean;
  /** La página de la rutina (el entreno guiado es `${path}/entrenar`). */
  path: string;
  source: "plan" | "program" | "move";
  movedFrom: string | null;
  moveId: string | null;
  week: number | null;
  doneOn: string | null;
  status: ItemStatus;
};

export type DayPlan = {
  items: DayItem[];
  /** Si es hoy: lo planeado antes en la semana que no se hizo. */
  pending: (DayItem & { date: string })[];
  hasPlan: boolean;
};

export type ProgramRun = {
  id: string;
  key: string;
  name: string;
  weeks: number;
  daysPerWeek: number;
  weekdays: number[];
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "finished";
  currentWeek: number;
  done: number;
  total: number;
};

export type TemplateDay = {
  weekday: number;
  routineId: string | null;
  readyKey: string | null;
  name: string | null;
  minutes: number;
  exists: boolean;
  path: string | null;
};

export type Week = {
  today: string;
  monday: string;
  sunday: string;
  days: { date: string; weekday: number; items: DayItem[] }[];
  template: TemplateDay[];
  /** Un programa corre esta semana: el plan queda en pausa. */
  planPaused: boolean;
  program: ProgramRun | null;
  settings: FitSettings;
};

export type Home = {
  today: string;
  date: string;
  streak: Streak;
  settings: FitSettings;
  plan: DayPlan;
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
