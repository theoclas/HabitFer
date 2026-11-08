import { HabitKind } from '@prisma/client';
import { runningStreaks, shiftKey, type RuleHabit } from '../habits/habit-rules';

export const XP_PER_COMPLETION = 10;
export const XP_PERFECT_DAY = 20;
/** Cada dia limpio completo de un habito para dejar. */
export const XP_PER_CLEAN_DAY = 5;

/** Bono por racha larga en el momento de cumplir. */
export function streakBonus(streak: number): number {
  if (streak >= 30) return 5;
  if (streak >= 7) return 3;
  return 0;
}

export type XpHabit = RuleHabit & {
  /** Dia de creacion: los dias limpio anteriores (inicio retroactivo) no dan XP. */
  createdKey: string;
};

/**
 * XP total e XP ganada hoy: 10 por habito cumplido (con bono por racha de dias), 5 por cada dia
 * limpio completo de un habito para dejar (desde que se creo) y 20 por dia perfecto.
 */
export function computeXp(habits: XpHabit[], perfectKeys: string[], todayKey: string): { xp: number; todayXp: number } {
  let xp = 0;
  let todayXp = 0;
  for (const h of habits) {
    if (h.kind === HabitKind.QUIT) {
      const from = h.createdKey > h.startKey ? h.createdKey : h.startKey;
      // Solo dias ya terminados: hoy todavia puede haber recaida.
      for (let key = from, i = 0; key < todayKey && i < 4000; key = shiftKey(key, 1), i++) {
        if (!h.doneKeys.has(key)) xp += XP_PER_CLEAN_DAY;
      }
      continue;
    }
    for (const { key, streak } of runningStreaks(h, todayKey)) {
      const gain = XP_PER_COMPLETION + (h.streakEnabled ? streakBonus(streak) : 0);
      xp += gain;
      if (key === todayKey) todayXp += gain;
    }
  }
  for (const key of perfectKeys) {
    xp += XP_PERFECT_DAY;
    if (key === todayKey) todayXp += XP_PERFECT_DAY;
  }
  return { xp, todayXp };
}

/** XP acumulada necesaria para llegar a un nivel: 0, 100, 300, 600, 1000... */
export function levelStartXp(level: number): number {
  return 50 * (level - 1) * level;
}

export function levelTitle(level: number): string {
  if (level >= 35) return 'Fénix';
  if (level >= 20) return 'Leyenda';
  if (level >= 10) return 'Imparable';
  if (level >= 5) return 'Constante';
  return 'Chispa';
}

export function levelFromXp(xp: number): { level: number; title: string; levelStartXp: number; nextLevelXp: number } {
  let level = 1;
  while (levelStartXp(level + 1) <= xp) level++;
  return { level, title: levelTitle(level), levelStartXp: levelStartXp(level), nextLevelXp: levelStartXp(level + 1) };
}

/** Congeladores ganados: uno por cada nivel que se sube. */
export function freezesEarned(level: number): number {
  return Math.max(0, level - 1);
}
