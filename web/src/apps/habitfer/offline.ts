/**
 * Marcados sin conexion: si la red falla, el cambio queda en cola (en este dispositivo)
 * y se envia cuando vuelve la señal. La pantalla ya muestra el check gracias al cambio optimista.
 */
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { completeHabit, setHabitProgress, uncompleteHabit } from "../../api/client";
import type { CompleteHabitResponse, Habit } from "../../types";
import { notifyHabitsChanged } from "./effects";

type QueuedOp = {
  kind: "complete" | "uncomplete" | "value";
  habitId: string;
  date: string;
  note?: string;
  /** Cantidad del dia (medibles). */
  value?: number;
  at: number;
};

const KEY = "hf_offline_queue";
const EVENT = "habitfer:offline-queue";

function read(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedOp[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(ops: QueuedOp[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ops));
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Sin respuesta del servidor (sin señal, servidor caido): vale la pena reintentar. */
export function isOfflineError(err: unknown): boolean {
  return isAxiosError(err) && !err.response;
}

/** Guarda la ultima intencion para ese habito y ese dia (cada cambio reemplaza al anterior). */
function enqueue(op: Omit<QueuedOp, "at">) {
  const ops = read().filter((o) => !(o.habitId === op.habitId && o.date === op.date));
  ops.push({ ...op, at: Date.now() });
  write(ops);
}

export function queuedCount(): number {
  return read().length;
}

type ToggleResult =
  | { queued: true }
  | { queued: false; completed: CompleteHabitResponse }
  | { queued: false; uncompleted: Habit };

/** Marca o desmarca; sin conexion lo deja en cola en vez de fallar. */
export async function toggleHabitRemote(habitId: string, date: string, complete: boolean, note?: string): Promise<ToggleResult> {
  try {
    if (complete) return { queued: false, completed: await completeHabit(habitId, date, note) };
    return { queued: false, uncompleted: await uncompleteHabit(habitId, date) };
  } catch (err) {
    if (!isOfflineError(err)) throw err;
    enqueue({ kind: complete ? "complete" : "uncomplete", habitId, date, note });
    return { queued: true };
  }
}

type ValueResult = { queued: true } | { queued: false; result: CompleteHabitResponse };

/** Fija la cantidad del dia (medibles); sin conexion queda en cola (gana la ultima). */
export async function setValueRemote(habitId: string, date: string, value: number, note?: string): Promise<ValueResult> {
  try {
    return { queued: false, result: await setHabitProgress(habitId, date, value, note) };
  } catch (err) {
    if (!isOfflineError(err)) throw err;
    enqueue({ kind: "value", habitId, date, value, note });
    return { queued: true };
  }
}

let flushing = false;

/** Envia la cola en orden. Para al primer error de red; descarta lo que el servidor rechaza. */
export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const op of read()) {
      try {
        if (op.kind === "complete") await completeHabit(op.habitId, op.date, op.note);
        else if (op.kind === "value") await setHabitProgress(op.habitId, op.date, op.value ?? 0, op.note);
        else await uncompleteHabit(op.habitId, op.date);
        sent++;
      } catch (err) {
        if (isOfflineError(err)) break;
        // El servidor no lo acepto (p. ej. ya pasaron dos dias): no tiene sentido reintentarlo.
      }
      write(read().filter((o) => !(o.habitId === op.habitId && o.date === op.date && o.at === op.at)));
    }
  } finally {
    flushing = false;
  }
  if (sent > 0) notifyHabitsChanged();
  return sent;
}

/** Conexion y cambios pendientes, para el aviso del encabezado. */
export function useConnectivity() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(queuedCount);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const queue = () => setPending(queuedCount());
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener(EVENT, queue);
    window.addEventListener("storage", queue);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener(EVENT, queue);
      window.removeEventListener("storage", queue);
    };
  }, []);
  return { online, pending };
}
