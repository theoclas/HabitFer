import type { Habit } from "../../types";

const DAY_LABELS: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mie",
  4: "Jue",
  5: "Vie",
  6: "Sab",
  7: "Dom",
};

export function habitScheduleLabel(habit: Pick<Habit, "scheduleType" | "scheduleDays">): string {
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
