/** Horas de aviso y textos de las notificaciones (funciones puras, con tests). */

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MAX_REMINDER_TIMES = 4;

/** Horas validas, sin repetir, ordenadas y como mucho 4. */
export function normalizeReminderTimes(times: unknown): string[] {
  if (!Array.isArray(times)) return [];
  const valid = times.filter((t): t is string => typeof t === 'string' && HHMM.test(t));
  return [...new Set(valid)].sort().slice(0, MAX_REMINDER_TIMES);
}

/** Horas de aviso efectivas de un habito (habitos viejos solo tienen reminderTime). */
export function habitReminderTimes(h: { reminderEnabled: boolean; reminderTime: string | null; reminderTimes: unknown }): string[] {
  if (!h.reminderEnabled) return [];
  const list = normalizeReminderTimes(h.reminderTimes);
  if (list.length === 0 && h.reminderTime && HHMM.test(h.reminderTime)) return [h.reminderTime];
  return list;
}

export function habitReminderBody(streak: number): string {
  if (streak >= 3) return `Llevas ${streak} días seguidos: no la dejes apagar.`;
  if (streak > 0) return `Vas ${streak === 1 ? '1 día' : `${streak} días`}. Sigue encendiendo la racha.`;
  return 'Es hora de tu hábito.';
}

export type PendingHabit = { title: string; streak: number; streakEnabled: boolean };

function joinTitles(titles: string[]): string {
  if (titles.length === 1) return titles[0];
  if (titles.length === 2) return `${titles[0]} y ${titles[1]}`;
  if (titles.length === 3) return `${titles[0]}, ${titles[1]} y ${titles[2]}`;
  return `${titles.slice(0, 2).join(', ')} y ${titles.length - 2} más`;
}

/**
 * Texto del resumen nocturno: lo que falta hoy y la racha mas larga que esta en riesgo.
 * Devuelve null si no falta nada.
 */
export function buildSummaryText(pending: PendingHabit[]): { title: string; body: string } | null {
  if (pending.length === 0) return null;
  const titles = pending.map((p) => p.title);
  const lead =
    pending.length === 1 ? `Te falta ${titles[0]}.` : `Te faltan ${pending.length}: ${joinTitles(titles)}.`;
  const atRisk = pending
    .filter((p) => p.streakEnabled && p.streak >= 3)
    .sort((a, b) => b.streak - a.streak)[0];
  const risk = atRisk ? ` La racha de ${atRisk.streak} días de ${atRisk.title} está en riesgo.` : '';
  const title = atRisk ? '🔥 Tu racha está en riesgo' : 'Todavía puedes cerrar el día';
  return { title, body: `${lead}${risk}` };
}
