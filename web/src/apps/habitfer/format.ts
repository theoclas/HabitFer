/** Formatos compartidos de HabitFer (cifras, horas, dias y animo). */

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("es-CO");
}

export const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
export const WEEKDAY_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function period(h: number) {
  return h < 12 ? "a. m." : "p. m.";
}

function h12(h: number) {
  const x = h % 12;
  return x === 0 ? 12 : x;
}

/** 6 → "6 a. m."; 18 → "6 p. m.". */
export function hourLabel(h: number): string {
  return `${h12(h)} ${period(h)}`;
}

/** Franja de una hora: "6 a 7 a. m.", "11 a. m. a 12 p. m.". */
export function hourRange(h: number): string {
  const next = (h + 1) % 24;
  if (period(h) === period(next)) return `${h12(h)} a ${h12(next)} ${period(h)}`;
  return `${hourLabel(h)} a ${hourLabel(next)}`;
}

export const MOODS = [
  { value: 1, emoji: "😞", label: "Muy mal" },
  { value: 2, emoji: "😕", label: "Mal" },
  { value: 3, emoji: "😐", label: "Normal" },
  { value: 4, emoji: "🙂", label: "Bien" },
  { value: 5, emoji: "😄", label: "Excelente" },
];

export function moodEmoji(value: number | null | undefined): string {
  if (!value) return "·";
  return MOODS[Math.min(5, Math.max(1, Math.round(value))) - 1].emoji;
}
