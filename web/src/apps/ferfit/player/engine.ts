import type { Step } from "./plan.ts";

/*
 * El reloj del modo guiado, sin pantalla: en qué paso va, cuánto falta y qué se terminó. Todo con marcas de
 * tiempo (no con un contador), así no se atrasa y, si el celular dejó la app en segundo plano, al volver se
 * ponen al día los pasos con tiempo que ya pasaron. Funciones puras (se prueban solas con Node).
 */

export type Status = "ready" | "running" | "paused" | "finished";

export type EngineState = {
  index: number;
  status: Status;
  /** Corriendo y con tiempo: cuándo termina el paso (ms). */
  endsAt: number | null;
  /** En pausa y con tiempo: lo que faltaba (ms). */
  leftMs: number | null;
  /** Con tiempo: lo que dura el paso ahora (crece con «+10 s»). */
  durMs: number;
  /** Cuándo empezó el paso (se corre con las pausas). */
  stepStart: number;
  pausedAt: number | null;
  /** Tiempo activo antes de `runningSince`. */
  activeMs: number;
  runningSince: number | null;
  /** Pasos de trabajo terminados (no los saltados). */
  done: number[];
};

/** El estado nuevo y qué pasó: pasos que empezaron, pasos de trabajo terminados y los que se deshicieron. */
export type Change = { state: EngineState; started: number[]; completed: number[]; undone: number[] };

export function idle(): EngineState {
  return { index: 0, status: "ready", endsAt: null, leftMs: null, durMs: 0, stepStart: 0, pausedAt: null, activeMs: 0, runningSince: null, done: [] };
}

const noChange = (state: EngineState): Change => ({ state, started: [], completed: [], undone: [] });

function enter(state: EngineState, steps: Step[], index: number, at: number, paused: boolean): EngineState {
  const step = steps[index];
  const dur = step && step.timed ? step.seconds * 1000 : 0;
  const timed = !!step?.timed;
  return {
    ...state,
    index,
    durMs: dur,
    stepStart: at,
    endsAt: !paused && timed ? at + dur : null,
    leftMs: paused && timed ? dur : null,
    pausedAt: paused ? at : null,
  };
}

function finish(s: EngineState, at: number): EngineState {
  const ran = s.runningSince !== null ? Math.max(0, at - s.runningSince) : 0;
  return { ...s, status: "finished", endsAt: null, leftMs: null, pausedAt: null, activeMs: s.activeMs + ran, runningSince: null };
}

/** Empezar a correr desde un paso (el primero, o donde iba un entrenamiento guardado a medias). */
export function start(steps: Step[], now: number, from?: Partial<Pick<EngineState, "index" | "activeMs" | "done">>): Change {
  const index = Math.min(Math.max(from?.index ?? 0, 0), Math.max(steps.length - 1, 0));
  const base: EngineState = { ...idle(), status: "running", activeMs: from?.activeMs ?? 0, runningSince: now, done: from?.done ?? [] };
  return { state: enter(base, steps, index, now, false), started: [index], completed: [], undone: [] };
}

/** Lo que pasó con el tiempo: termina los pasos con tiempo que ya se acabaron, uno tras otro si hace falta. */
export function tick(state: EngineState, steps: Step[], now: number): Change {
  if (state.status !== "running") return noChange(state);
  let s = state;
  const started: number[] = [];
  const completed: number[] = [];
  while (s.status === "running" && s.endsAt !== null && now >= s.endsAt) {
    const at = s.endsAt;
    if (steps[s.index]?.kind === "work" && !s.done.includes(s.index)) {
      s = { ...s, done: [...s.done, s.index] };
      completed.push(s.index);
    }
    if (s.index + 1 >= steps.length) {
      s = finish(s, at);
      break;
    }
    s = enter(s, steps, s.index + 1, at, false);
    started.push(s.index);
  }
  return { state: s, started, completed, undone: [] };
}

function move(state: EngineState, steps: Step[], now: number, markDone: boolean): Change {
  if (state.status === "ready" || state.status === "finished") return noChange(state);
  let s = state;
  const completed: number[] = [];
  if (markDone && steps[s.index]?.kind === "work" && !s.done.includes(s.index)) {
    s = { ...s, done: [...s.done, s.index] };
    completed.push(s.index);
  }
  if (s.index + 1 >= steps.length) return { state: finish(s, now), started: [], completed, undone: [] };
  // Si estaba en pausa, el paso siguiente también queda en pausa.
  s = enter(s, steps, s.index + 1, now, s.status === "paused");
  return { state: s, started: [s.index], completed, undone: [] };
}

/** «Listo» (o «terminé antes»): el paso de trabajo cuenta como hecho y sigue el próximo. */
export function complete(state: EngineState, steps: Step[], now: number): Change {
  return move(state, steps, now, true);
}

/** Saltar: sigue el próximo paso sin contar el actual. */
export function skip(state: EngineState, steps: Step[], now: number): Change {
  return move(state, steps, now, false);
}

/** Atrás: repite el ejercicio de ahora si ya lleva más de 3 s; si no, vuelve al ejercicio anterior. */
export function back(state: EngineState, steps: Step[], now: number): Change {
  if (state.status === "ready" || state.status === "finished") return noChange(state);
  let target = state.index;
  if (!(steps[state.index]?.kind === "work" && stepElapsed(state, now) > 3000)) {
    let j = state.index - 1;
    while (j > 0 && steps[j].kind !== "work") j--;
    target = Math.max(j, 0);
  }
  const undone = state.done.filter((i) => i >= target);
  const s = enter({ ...state, done: state.done.filter((i) => i < target) }, steps, target, now, state.status === "paused");
  return { state: s, started: [target], completed: [], undone };
}

export function pause(s: EngineState, now: number): EngineState {
  if (s.status !== "running") return s;
  return {
    ...s,
    status: "paused",
    leftMs: s.endsAt !== null ? Math.max(0, s.endsAt - now) : null,
    endsAt: null,
    pausedAt: now,
    activeMs: s.activeMs + Math.max(0, now - (s.runningSince ?? now)),
    runningSince: null,
  };
}

export function resume(s: EngineState, now: number): EngineState {
  if (s.status !== "paused") return s;
  const shift = Math.max(0, now - (s.pausedAt ?? now));
  return {
    ...s,
    status: "running",
    endsAt: s.leftMs !== null ? now + s.leftMs : null,
    leftMs: null,
    stepStart: s.stepStart + shift,
    pausedAt: null,
    runningSince: now,
  };
}

/** Más tiempo al paso de ahora (por ejemplo, +10 s de descanso). */
export function addTime(s: EngineState, steps: Step[], ms: number): EngineState {
  if (!steps[s.index]?.timed) return s;
  if (s.status === "running" && s.endsAt !== null) return { ...s, endsAt: s.endsAt + ms, durMs: s.durMs + ms };
  if (s.status === "paused" && s.leftMs !== null) return { ...s, leftMs: s.leftMs + ms, durMs: s.durMs + ms };
  return s;
}

/** Lo que falta del paso con tiempo (ms). */
export function leftMs(s: EngineState, now: number): number {
  if (s.status === "running" && s.endsAt !== null) return Math.max(0, s.endsAt - now);
  return s.leftMs ?? 0;
}

/** Lo que lleva el paso de ahora (ms), sin contar las pausas. */
export function stepElapsed(s: EngineState, now: number): number {
  const end = s.status === "paused" ? (s.pausedAt ?? now) : now;
  return Math.max(0, end - s.stepStart);
}

/** Tiempo activo del entrenamiento (ms), sin las pausas. */
export function activeTime(s: EngineState, now: number): number {
  return s.activeMs + (s.status === "running" && s.runningSince !== null ? Math.max(0, now - s.runningSince) : 0);
}

/** Para guardar a medias: queda en pausa donde iba. */
export function frozen(s: EngineState, now: number): EngineState {
  return s.status === "running" ? pause(s, now) : s;
}
