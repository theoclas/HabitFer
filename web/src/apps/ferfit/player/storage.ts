import type { SetLog } from "../types.ts";
import type { EngineState } from "./engine.ts";
import type { PlanOptions } from "./plan.ts";

/*
 * Lo que el modo guiado recuerda en el teléfono: las preferencias (voz, sonidos, calentar, estirar, intervalos) y
 * el entrenamiento que quedó a medias, para seguir donde ibas si se cerró la app.
 */

const PREFS_KEY = "fit_player_prefs";
const SESSION_KEY = "fit_player_session";
/** Un entrenamiento a medias se ofrece para seguir hasta 12 horas después. */
export const SESSION_MAX_AGE_MS = 12 * 3600 * 1000;

export type PlayerPrefs = {
  voice: boolean;
  sounds: boolean;
  /** null: lo que sugiera la rutina (prendido, salvo en las de movilidad o estiramiento). */
  warmup: boolean | null;
  cooldown: boolean | null;
  work: number;
  rest: number;
  rounds: number;
};

export const DEFAULT_PREFS: PlayerPrefs = { voice: true, sounds: true, warmup: null, cooldown: null, work: 40, rest: 20, rounds: 3 };

export function readPrefs(): PlayerPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<PlayerPrefs>) : {};
    return { ...DEFAULT_PREFS, ...v };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(p: PlayerPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
}

export type SavedSession = {
  v: 1;
  /** «r:<id>» para una rutina propia, «l:<clave>» para una lista. */
  ref: string;
  /** El día al que se anota. */
  date: string;
  options: PlanOptions;
  /** Huella del plan: si la rutina cambió, no se puede seguir. */
  sig: string;
  state: EngineState;
  /** Las series anotadas, por paso. */
  logs: Record<number, SetLog>;
  savedAt: number;
};

/** El entrenamiento a medias de esa rutina, si lo hay y no es muy viejo. */
export function readSession(ref: string, now = Date.now()): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedSession;
    if (s?.v !== 1 || s.ref !== ref || typeof s.savedAt !== "number" || now - s.savedAt > SESSION_MAX_AGE_MS) return null;
    if (!s.state || typeof s.state.index !== "number" || !Array.isArray(s.state.done)) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeSession(s: SavedSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: no se podrá seguir después */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* nada que borrar */
  }
}
