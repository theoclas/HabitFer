import { api } from "../../api/client";
import type { FitSettings, History, Home, Library, Routine, RoutineInput, Week, Workout, WorkoutSave } from "./types";

const LIB_KEY = "fit_library";

/** La biblioteca guardada en el teléfono (si la hay): sirve para pintar de una vez mientras llega la de la API. */
export function cachedLibrary(): Library | null {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    return raw ? (JSON.parse(raw) as Library) : null;
  } catch {
    return null;
  }
}

export async function fetchLibrary(): Promise<Library> {
  const { data } = await api.get<Library>("/fit/library");
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(data));
  } catch {
    /* sin espacio: se vuelve a pedir la próxima vez */
  }
  return data;
}

export async function fetchHome(date?: string) {
  const { data } = await api.get<Home>("/fit/home", { params: date ? { date } : {} });
  return data;
}

export async function fetchRoutine(id: string) {
  const { data } = await api.get<Routine>(`/fit/routines/${encodeURIComponent(id)}`);
  return data;
}

export async function fetchRoutines() {
  const { data } = await api.get<Routine[]>("/fit/routines");
  return data;
}

export async function createRoutine(input: RoutineInput) {
  const { data } = await api.post<Routine>("/fit/routines", input);
  return data;
}

export async function updateRoutine(id: string, input: RoutineInput) {
  const { data } = await api.put<Routine>(`/fit/routines/${encodeURIComponent(id)}`, input);
  return data;
}

export async function deleteRoutine(id: string) {
  await api.delete(`/fit/routines/${encodeURIComponent(id)}`);
}

export async function copyReadyRoutine(readyKey: string) {
  const { data } = await api.post<Routine>("/fit/routines/copy", { readyKey });
  return data;
}

export async function fetchWorkouts(from: string, to: string) {
  const { data } = await api.get<Workout[]>("/fit/workouts", { params: { from, to } });
  return data;
}

export async function saveWorkout(input: WorkoutSave) {
  const { data } = await api.post<Workout>("/fit/workouts", input);
  return data;
}

export async function updateWorkout(id: string, patch: { done?: number[]; completed?: boolean; minutes?: number; effort?: number }) {
  const { data } = await api.patch<Workout>(`/fit/workouts/${encodeURIComponent(id)}`, patch);
  return data;
}

/** La última vez de cada ejercicio con series anotadas. */
export async function fetchHistory(keys: string[]): Promise<History> {
  const unique = [...new Set(keys)].slice(0, 40);
  if (!unique.length) return {};
  const { data } = await api.get<History>("/fit/history", { params: { keys: unique.join(",") } });
  return data;
}

export async function deleteWorkout(id: string) {
  await api.delete(`/fit/workouts/${encodeURIComponent(id)}`);
}

/** Cambia solo lo que se mande: la meta (días o minutos) y el recordatorio. */
export async function saveFitSettings(patch: Partial<FitSettings>) {
  const { data } = await api.put<FitSettings>("/fit/settings", patch);
  return data;
}

/* ---------- La semana ---------- */

export async function fetchWeek(date?: string) {
  const { data } = await api.get<Week>("/fit/week", { params: date ? { date } : {} });
  return data;
}

/** El plan de la semana: una rutina por día (0 = lunes); los días que no van quedan de descanso. */
export async function savePlan(days: { weekday: number; routineId?: string; readyKey?: string }[]) {
  const { data } = await api.put<Week>("/fit/plan", { days });
  return data;
}

/** Pasa una rutina planeada a otro día de la misma semana. */
export async function moveRoutine(input: { from: string; to: string; routineId?: string | null; readyKey?: string | null }) {
  const body = { from: input.from, to: input.to, ...(input.routineId ? { routineId: input.routineId } : { readyKey: input.readyKey ?? undefined }) };
  const { data } = await api.post<Week>("/fit/plan/moves", body);
  return data;
}

export async function undoMove(id: string) {
  const { data } = await api.delete<Week>(`/fit/plan/moves/${encodeURIComponent(id)}`);
  return data;
}

export async function startProgram(input: { programKey: string; weekdays: number[]; start: "this" | "next" }) {
  const { data } = await api.post<Week>("/fit/programs/start", input);
  return data;
}

export async function stopProgram() {
  const { data } = await api.post<Week>("/fit/programs/stop", {});
  return data;
}
