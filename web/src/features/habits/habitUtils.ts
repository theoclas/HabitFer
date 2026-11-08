import type { Habit, StreakUnit } from "../../types";

const DAY_LABELS: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mie",
  4: "Jue",
  5: "Vie",
  6: "Sab",
  7: "Dom",
};

type ScheduleBits = Pick<Habit, "scheduleType" | "scheduleDays"> & Partial<Pick<Habit, "kind" | "weeklyTarget">>;

export function habitScheduleLabel(habit: ScheduleBits): string {
  if (habit.kind === "QUIT") return "Para dejar";
  if (habit.scheduleType === "WEEKLY_COUNT") {
    const n = habit.weeklyTarget ?? 3;
    return n === 1 ? "1 vez por semana" : `${n} veces por semana`;
  }
  if (habit.scheduleType === "DAILY") return "Cada dia";
  const days = habit.scheduleDays.map((d) => DAY_LABELS[d]).filter(Boolean);
  return days.length ? days.join(", ") : "Semanal";
}

export function habitCardBackground(color: string): string {
  return `linear-gradient(155deg, ${color}d9 0%, ${color}80 38%, ${color}30 100%)`;
}

export function habitEmoji(icon: string | null | undefined): string {
  return icon?.trim() || "✨";
}

export function isQuit(h: Pick<Habit, "kind">): boolean {
  return h.kind === "QUIT";
}

/** Habito con meta de cantidad (8 vasos, 30 minutos). */
export function isMeasurable(h: Pick<Habit, "kind" | "goal">): boolean {
  return h.kind !== "QUIT" && (h.goal ?? 1) > 1;
}

export function isWeeklyCount(h: Pick<Habit, "kind" | "scheduleType">): boolean {
  return h.kind !== "QUIT" && h.scheduleType === "WEEKLY_COUNT";
}

/**
 * Cuenta para el dia (orbe, dia perfecto, pendientes del icono): lo que se pedia ese dia,
 * mas lo flexible que si se hizo. Lo que esta en pausa o congelado no se pide.
 */
export function countsForDay(h: Pick<Habit, "kind" | "requiredToday" | "completedToday">): boolean {
  return h.kind !== "QUIT" && (h.requiredToday || h.completedToday);
}

/** Unidad para una cantidad: con 1 se quita la "s" de plurales simples (vasos → vaso). */
export function unitFor(n: number, unit: string | null | undefined): string {
  if (!unit) return "";
  if (n === 1 && /[aiou]s$/i.test(unit)) return unit.slice(0, -1);
  return unit;
}

/** "3 de 8 vasos". */
export function amountLabel(value: number, goal: number, unit: string | null | undefined): string {
  const u = unitFor(goal, unit);
  return `${value} de ${goal}${u ? ` ${u}` : ""}`;
}

/** "12 días", "1 semana", "3 semanas". */
export function streakLabel(n: number, unit: StreakUnit = "days"): string {
  if (unit === "weeks") return n === 1 ? "1 semana" : `${n} semanas`;
  return n === 1 ? "1 día" : `${n} días`;
}

/** Dias equivalentes para el color de la llama (3 semanas = 21 dias). */
export function streakStageDays(n: number, unit: StreakUnit = "days"): number {
  return unit === "weeks" ? n * 7 : n;
}

/**
 * Cambio optimista al marcar o desmarcar: el check y la racha cambian al instante
 * y la respuesta del servidor los corrige despues si hiciera falta.
 * En X veces por semana la racha (en semanas) solo cambia al cruzar la meta de la semana.
 */
export function applyOptimisticToggle<T extends Habit>(habit: T, completed: boolean): T {
  if (habit.completedToday === completed) return habit;
  if (isWeeklyCount(habit)) {
    const target = habit.weeklyTarget ?? 3;
    const before = habit.weekDone ?? 0;
    const after = Math.max(0, before + (completed ? 1 : -1));
    const delta = before < target && after >= target ? 1 : before >= target && after < target ? -1 : 0;
    const streak = habit.streakEnabled ? Math.max(0, habit.currentStreak + delta) : habit.currentStreak;
    return {
      ...habit,
      completedToday: completed,
      valueToday: completed ? 1 : 0,
      weekDone: after,
      currentStreak: streak,
      longestStreak: Math.max(habit.longestStreak, streak),
    };
  }
  const streak = habit.streakEnabled ? Math.max(0, habit.currentStreak + (completed ? 1 : -1)) : habit.currentStreak;
  return {
    ...habit,
    completedToday: completed,
    valueToday: completed ? Math.max(1, habit.goal) : 0,
    frozenToday: completed ? false : habit.frozenToday,
    currentStreak: streak,
    longestStreak: Math.max(habit.longestStreak, streak),
  };
}

/** Cambio optimista de cantidad (medibles): al cruzar la meta se marca o desmarca. */
export function applyOptimisticValue<T extends Habit>(habit: T, value: number): T {
  const v = Math.max(0, Math.round(value));
  const done = v >= Math.max(1, habit.goal);
  const toggled = applyOptimisticToggle(habit, done);
  return { ...toggled, valueToday: v };
}
