/*
 * El plan del modo guiado: convierte una rutina en pasos (prepárate, trabajo, descanso) con lo que dice la voz.
 * Funciones puras (se prueban solas con Node).
 */

export type StepKind = "prep" | "work" | "rest";
export type StepBlock = "warmup" | "main" | "cooldown";
export type PlanMode = "normal" | "intervals" | "emom";

/** Un ejercicio de la rutina: series, repeticiones o segundos (por lado si el ejercicio es por lado) y descanso. */
export type PlanItem = { key: string; sets: number; reps: number | null; seconds: number | null; rest: number };
export type PlanRoutine = { circuit: boolean; rounds: number; items: PlanItem[] };
export type ExerciseInfo = { name: string; perSide?: boolean };

export type PlanOptions = {
  /** Calentar 5 minutos al empezar. */
  warmup: boolean;
  /** Estirar 5 minutos al terminar. */
  cooldown: boolean;
  /** Como está la rutina, por intervalos de tiempo o cada minuto (EMOM). */
  mode: PlanMode;
  /** Intervalos: segundos de trabajo y de descanso. */
  work: number;
  rest: number;
  /** Intervalos y cada minuto: vueltas a toda la lista. */
  rounds: number;
};

export type Step = {
  kind: StepKind;
  block: StepBlock;
  /** El ejercicio: el que se hace (trabajo) o el que sigue (prepárate y descanso). */
  key: string;
  /** Posición en la rutina (solo los pasos de trabajo de la rutina; null en calentar y estirar). */
  item: number | null;
  /** Serie o vuelta de este ejercicio, y cuántas son. */
  set: number;
  sets: number;
  /** Ejercicio número `pos` de `count` dentro de su bloque. */
  pos: number;
  count: number;
  /** Con tiempo (corre solo) o por repeticiones (se toca «Listo»). Prepárate y descanso siempre van con tiempo. */
  timed: boolean;
  /** Segundos del paso (en los ejercicios por lado, los dos lados). */
  seconds: number;
  /** Repeticiones a hacer (por repeticiones y cada minuto). */
  reps: number | null;
  /** Cada minuto con un ejercicio de tiempo: segundos a sostener dentro del minuto. */
  goalSeconds: number | null;
  perSide: boolean;
  emom: boolean;
  /** «Serie 2 de 3», «Vuelta 1 de 3», «Minuto 4 de 16», «Calentamiento 2 de 6». */
  label: string;
  /** Lo que dice la voz al empezar el paso. */
  say: string;
};

export const PREP_SECONDS = 10;
/** Entre un ejercicio y otro cuando la rutina no tiene descanso. */
export const SWITCH_SECONDS = 10;
/** Entre el calentamiento, la rutina y el estiramiento. */
export const BLOCK_SWITCH_SECONDS = 15;
/** Lo que toma una repetición, para calcular el tiempo. */
export const REP_SECONDS = 3;

export const DEFAULT_OPTIONS: PlanOptions = { warmup: true, cooldown: true, mode: "normal", work: 40, rest: 20, rounds: 3 };

/** Intervalos de siempre: trabajo y descanso en segundos. */
export const INTERVAL_PRESETS = [
  { label: "Tabata 20/10", work: 20, rest: 10 },
  { label: "30/30", work: 30, rest: 30 },
  { label: "40/20", work: 40, rest: 20 },
  { label: "45/15", work: 45, rest: 15 },
] as const;

const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));

type Unit = Omit<Step, "kind" | "say"> & { restAfter: number };

function repsText(reps: number | null, perSide: boolean): string {
  return `${reps ?? 10} repeticiones${perSide ? " por lado" : ""}`;
}

function blockUnits(items: PlanItem[], block: StepBlock, title: string, info: (key: string) => ExerciseInfo | undefined): Unit[] {
  const list = items.filter((i) => info(i.key));
  return list.map((it, k) => {
    const perSide = !!info(it.key)?.perSide;
    return {
      block,
      key: it.key,
      item: null,
      set: 1,
      sets: 1,
      pos: k + 1,
      count: list.length,
      timed: true,
      seconds: clampInt(it.seconds ?? 30, 5, 600) * (perSide ? 2 : 1),
      reps: null,
      goalSeconds: null,
      perSide,
      emom: false,
      label: `${title} ${k + 1} de ${list.length}`,
      restAfter: clampInt(it.rest, 0, 120),
    };
  });
}

function mainUnits(routine: PlanRoutine, opts: PlanOptions, info: (key: string) => ExerciseInfo | undefined): Unit[] {
  const main = routine.items.map((it, index) => ({ it, index })).filter(({ it }) => info(it.key));
  const count = main.length;
  const out: Unit[] = [];
  const base = (it: PlanItem, index: number, k: number) => ({
    block: "main" as const,
    key: it.key,
    item: index,
    pos: k + 1,
    count,
    perSide: !!info(it.key)?.perSide,
    goalSeconds: null,
    emom: false,
  });

  if (opts.mode === "intervals") {
    const rounds = clampInt(opts.rounds, 1, 10);
    const work = clampInt(opts.work, 5, 600);
    const rest = clampInt(opts.rest, 0, 600);
    for (let r = 1; r <= rounds; r++) {
      main.forEach(({ it, index }, k) =>
        out.push({ ...base(it, index, k), set: r, sets: rounds, timed: true, seconds: work, reps: null, label: `Vuelta ${r} de ${rounds}`, restAfter: rest }),
      );
    }
    return out;
  }

  if (opts.mode === "emom") {
    const rounds = clampInt(opts.rounds, 1, 10);
    const total = rounds * count;
    let minute = 0;
    for (let r = 1; r <= rounds; r++) {
      main.forEach(({ it, index }, k) => {
        minute++;
        const b = base(it, index, k);
        const hold = it.seconds != null ? Math.min(50, it.seconds * (b.perSide ? 2 : 1)) : null;
        out.push({
          ...b,
          set: r,
          sets: rounds,
          timed: true,
          seconds: 60,
          reps: hold === null ? (it.reps ?? 10) : null,
          goalSeconds: hold,
          emom: true,
          label: `Minuto ${minute} de ${total}`,
          restAfter: 0,
        });
      });
    }
    return out;
  }

  if (routine.circuit) {
    const rounds = clampInt(routine.rounds, 1, 10);
    for (let r = 1; r <= rounds; r++) {
      main.forEach(({ it, index }, k) => {
        const b = base(it, index, k);
        const timed = it.seconds != null;
        out.push({
          ...b,
          set: r,
          sets: rounds,
          timed,
          seconds: timed ? clampInt(it.seconds!, 5, 900) * (b.perSide ? 2 : 1) : 0,
          reps: timed ? null : (it.reps ?? 10),
          label: `Vuelta ${r} de ${rounds}`,
          restAfter: Math.max(clampInt(it.rest, 0, 600), 5),
        });
      });
    }
    return out;
  }

  main.forEach(({ it, index }, k) => {
    const b = base(it, index, k);
    const timed = it.seconds != null;
    const sets = clampInt(it.sets, 1, 10);
    const rest = clampInt(it.rest, 0, 600);
    for (let s = 1; s <= sets; s++) {
      out.push({
        ...b,
        set: s,
        sets,
        timed,
        seconds: timed ? clampInt(it.seconds!, 5, 900) * (b.perSide ? 2 : 1) : 0,
        reps: timed ? null : (it.reps ?? 10),
        label: sets > 1 ? `Serie ${s} de ${sets}` : "",
        restAfter: s < sets ? rest : Math.max(rest, SWITCH_SECONDS),
      });
    }
  });
  return out;
}

function workSay(u: Unit): string {
  if (u.emom) {
    const what = u.goalSeconds != null ? `${u.goalSeconds} segundos` : repsText(u.reps, u.perSide);
    return `¡Vamos! ${what}, y descansa lo que quede del minuto.`;
  }
  if (!u.timed) return `¡Vamos! ${repsText(u.reps, u.perSide)}.`;
  return u.perSide ? "¡Vamos! Primer lado." : "¡Vamos!";
}

function restSay(prev: Unit, next: Unit, rest: number, name: string): string {
  if (next.block !== prev.block) {
    if (next.block === "main") return `Bien. Ahora sí, la rutina. Primero: ${name}.`;
    if (next.block === "cooldown") return `¡Terminaste la rutina! Ahora a estirar. Primero: ${name}.`;
  }
  const sameExercise = next.key === prev.key && next.item === prev.item;
  if (sameExercise) return rest >= 10 ? `Descanso de ${rest} segundos.` : "Descansa.";
  if (rest >= 15) return `Descanso de ${rest} segundos. Sigue: ${name}.`;
  return `Sigue: ${name}.`;
}

/**
 * Los pasos de una rutina. `blocks`: el calentamiento y el estiramiento (se usan si las opciones los piden).
 * Una rutina sin ejercicios conocidos no tiene pasos.
 */
export function buildPlan(
  routine: PlanRoutine,
  opts: PlanOptions,
  info: (key: string) => ExerciseInfo | undefined,
  blocks?: { warmup: PlanItem[]; cooldown: PlanItem[] },
): Step[] {
  const main = mainUnits(routine, opts, info);
  if (!main.length) return [];
  const units: Unit[] = [
    ...(opts.warmup && blocks ? blockUnits(blocks.warmup, "warmup", "Calentamiento", info) : []),
    ...main,
    ...(opts.cooldown && blocks ? blockUnits(blocks.cooldown, "cooldown", "Estirar", info) : []),
  ];
  const name = (key: string) => info(key)?.name.toLowerCase() ?? "el siguiente ejercicio";
  const strip = ({ restAfter: _restAfter, ...u }: Unit) => u;
  const first = units[0];
  const steps: Step[] = [
    {
      ...strip(first),
      kind: "prep",
      item: null,
      timed: true,
      seconds: PREP_SECONDS,
      say: first.block === "warmup" ? `Prepárate para calentar. Primero: ${name(first.key)}.` : `Prepárate. Empezamos con ${name(first.key)}.`,
    },
  ];
  units.forEach((u, k) => {
    steps.push({ ...strip(u), kind: "work", say: workSay(u) });
    const next = units[k + 1];
    if (!next) return;
    const rest = next.block !== u.block ? Math.max(u.restAfter, BLOCK_SWITCH_SECONDS) : u.restAfter;
    if (rest <= 0) return;
    steps.push({ ...strip(next), kind: "rest", item: null, timed: true, seconds: rest, say: restSay(u, next, rest, name(next.key)) });
  });
  return steps;
}

/** Segundos que toma un paso (los de repeticiones, calculados). */
export function stepSeconds(s: Step): number {
  return s.timed ? s.seconds : (s.reps ?? 10) * REP_SECONDS * (s.perSide ? 2 : 1);
}

export function planSeconds(steps: Step[]): number {
  return steps.reduce((a, s) => a + stepSeconds(s), 0);
}

/** Una huella del plan, para saber si un entrenamiento guardado a medias sigue siendo el mismo. */
export function planSignature(steps: Step[]): string {
  const text = steps.map((s) => `${s.kind}:${s.key}:${s.item ?? "-"}:${s.set}:${s.timed ? s.seconds : `r${s.reps}`}`).join("|");
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${steps.length}-${(h >>> 0).toString(36)}`;
}

/** Una serie hecha: repeticiones, segundos (por lado, como en la rutina) y peso en kg. */
export type StepLog = { reps: number | null; seconds: number | null; weight: number | null };

/** Lo que se anota de un paso de trabajo si no se ajustó nada: lo planeado. */
export function defaultLog(s: Step): StepLog {
  if (s.emom) return { reps: s.reps, seconds: s.goalSeconds != null ? Math.round(s.perSide ? s.goalSeconds / 2 : s.goalSeconds) : null, weight: null };
  if (s.timed) return { reps: null, seconds: Math.round(s.perSide ? s.seconds / 2 : s.seconds), weight: null };
  return { reps: s.reps, seconds: null, weight: null };
}

/**
 * Lo que se guarda al terminar: los ejercicios de la rutina hechos (por su posición) y sus series reales en el
 * orden en que se hicieron. El calentamiento y el estiramiento no se anotan.
 */
export function summarize(steps: Step[], done: number[], logs: Record<number, StepLog>) {
  const byItem = new Map<number, StepLog[]>();
  for (const i of [...done].sort((a, b) => a - b)) {
    const s = steps[i];
    if (!s || s.kind !== "work" || s.item === null) continue;
    const list = byItem.get(s.item) ?? [];
    list.push(logs[i] ?? defaultLog(s));
    byItem.set(s.item, list);
  }
  const indexes = [...byItem.keys()].sort((a, b) => a - b);
  return {
    addDone: indexes,
    logs: indexes.map((index) => ({ index, sets: byItem.get(index)! })),
    exercises: indexes.length,
    sets: indexes.reduce((n, i) => n + byItem.get(i)!.length, 0),
  };
}

/** Calentar y estirar vienen prendidos, salvo en rutinas que ya son casi todas de movilidad o estiramiento. */
export function mostlyGentle(focuses: string[]): boolean {
  if (!focuses.length) return false;
  const gentle = focuses.filter((f) => f === "movilidad" || f === "estiramiento").length;
  return gentle / focuses.length >= 0.6;
}
