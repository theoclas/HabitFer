/**
 * Temporizador de enfoque para habitos medibles en minutos. Se abre desde cualquier pantalla
 * con un evento (lo muestra el shell) y la sesion se guarda para retomarla si se recarga.
 */
import { isMeasurable } from "../../features/habits/habitUtils";
import type { Habit } from "../../types";

export type FocusHabit = Pick<Habit, "id" | "title" | "icon" | "color" | "unit" | "goal" | "step" | "valueToday">;

export type FocusSession = {
  habit: FocusHabit;
  /** Dia (YYYY-MM-DD) al que se suman los minutos. */
  date: string;
  durationMs: number;
  /** Fin del temporizador si esta corriendo; null si esta en pausa. */
  endAt: number | null;
  /** Lo que falta cuando esta en pausa. */
  remainingMs: number;
};

export const FOCUS_EVENT = "habitfer:focus";
const KEY = "hf_focus";

/** Solo para medibles cuya unidad son minutos. */
export function canFocus(h: Pick<Habit, "kind" | "goal" | "unit">): boolean {
  return isMeasurable(h) && /^min/i.test((h.unit ?? "").trim());
}

export function startFocus(h: FocusHabit) {
  const habit: FocusHabit = { id: h.id, title: h.title, icon: h.icon, color: h.color, unit: h.unit, goal: h.goal, step: h.step, valueToday: h.valueToday ?? 0 };
  window.dispatchEvent(new CustomEvent<FocusHabit>(FOCUS_EVENT, { detail: habit }));
}

export function loadFocusSession(): FocusSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FocusSession) : null;
  } catch {
    return null;
  }
}

export function saveFocusSession(session: FocusSession | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
}

/** Minutos sugeridos: lo que falta para la meta, redondeado a 5 (entre 5 y 120). */
export function suggestedMinutes(h: FocusHabit): number {
  const left = Math.max(0, h.goal - h.valueToday);
  if (left > 0 && left < 5) return left;
  const base = left || Math.max(5, h.step);
  return Math.min(120, Math.max(5, Math.round(base / 5) * 5));
}

export function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
