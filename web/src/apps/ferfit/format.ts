/** Textos de FerFit: series y repeticiones, descansos, fechas. Funciones puras (se prueban solas). */

import type { SetLog } from "./types.ts";

export const LEVEL_LABELS: Record<number, string> = { 1: "Principiante", 2: "Intermedio", 3: "Avanzado" };
export const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

type Dose = { sets: number; reps?: number | null; seconds?: number | null };

/** «3 × 12», «3 × 30 s», «12 por lado»; en un circuito solo lo de cada vuelta. */
export function doseText(d: Dose, perSide = false, circuit = false): string {
  const each = d.seconds != null ? `${d.seconds} s` : `${d.reps ?? 0}`;
  const side = perSide ? " por lado" : "";
  return circuit || d.sets <= 1 ? `${each}${side}` : `${d.sets} × ${each}${side}`;
}

/** «Descanso de 45 s», «Descanso de 1 min 30 s», «Sin descanso». */
export function restText(seconds: number): string {
  if (seconds <= 0) return "Sin descanso";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `Descanso de ${s} s`;
  return `Descanso de ${m} min${s ? ` ${s} s` : ""}`;
}

export const minutesText = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`);

/** Fecha local del teléfono como AAAA-MM-DD. */
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «lunes 3 de noviembre». */
export function fullDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]} ${d} de ${MONTHS[m - 1]}`;
}

/** Los días de la semana empezando en lunes (0 = lunes), para el plan. */
export const WEEKDAY_LONG = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** «miércoles», por la fecha. */
export function weekdayName(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** «Lunes 9». */
export function dayTitle(key: string): string {
  const name = weekdayName(key);
  return `${name[0].toUpperCase()}${name.slice(1)} ${Number(key.slice(8, 10))}`;
}

/** «9 al 15 de noviembre», o «30 de noviembre al 6 de diciembre» si cambia el mes. */
export function weekRange(monday: string, sunday: string): string {
  const [, m1, d1] = monday.split("-").map(Number);
  const [, m2, d2] = sunday.split("-").map(Number);
  return m1 === m2 ? `${d1} al ${d2} de ${MONTHS[m2 - 1]}` : `${d1} de ${MONTHS[m1 - 1]} al ${d2} de ${MONTHS[m2 - 1]}`;
}

/** «Hoy», «Ayer» o «lunes 3 de noviembre». */
export function dayLabel(key: string, today: string): string {
  if (key === today) return "Hoy";
  if (key === shiftDay(today, -1)) return "Ayer";
  return fullDate(key);
}

/** «3 semanas», «1 semana». */
export const weeksText = (n: number) => `${n} ${n === 1 ? "semana" : "semanas"}`;
export const daysText = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** Reloj «m:ss». `up`: redondea hacia arriba (en la cuenta regresiva, 0,4 s se ve 0:01); `down`: hacia abajo. */
export function clock(ms: number, round: "up" | "down" = "up"): string {
  const secs = Math.max(0, round === "up" ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/** Kilos con coma: «5 kg», «7,5 kg». */
export const kgText = (n: number) => `${String(n).replace(".", ",")} kg`;

/** La última vez, corto: «12 · 12 · 10 rep · 5 kg», «30 s · 30 s», «12 · 10 rep · hasta 7,5 kg». */
export function lastText(sets: SetLog[]): string {
  if (!sets.length) return "";
  const allReps = sets.every((s) => s.reps != null);
  const parts = sets.map((s) => (s.reps != null ? String(s.reps) : s.seconds != null ? `${s.seconds} s` : "—"));
  const weights = sets.map((s) => s.weight).filter((w): w is number => w != null && w > 0);
  const max = weights.length ? Math.max(...weights) : null;
  const weight = max === null ? "" : weights.every((w) => w === max) ? ` · ${kgText(max)}` : ` · hasta ${kgText(max)}`;
  return parts.join(" · ") + (allReps ? " rep" : "") + weight;
}

/** «Esfuerzo 6/10 · moderado». */
export function effortText(n: number): string {
  const word = n <= 2 ? "muy suave" : n <= 4 ? "suave" : n <= 6 ? "moderado" : n <= 8 ? "duro" : "al máximo";
  return `Esfuerzo ${n}/10 · ${word}`;
}
