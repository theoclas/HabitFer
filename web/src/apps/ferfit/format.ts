/** Textos de FerFit: series y repeticiones, descansos, fechas. Funciones puras (se prueban solas). */

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

/** «Hoy», «Ayer» o «lunes 3 de noviembre». */
export function dayLabel(key: string, today: string): string {
  if (key === today) return "Hoy";
  if (key === shiftDay(today, -1)) return "Ayer";
  return fullDate(key);
}

/** «3 semanas», «1 semana». */
export const weeksText = (n: number) => `${n} ${n === 1 ? "semana" : "semanas"}`;
export const daysText = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
