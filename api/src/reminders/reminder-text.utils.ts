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

/**
 * Unidad para una cantidad: con 1 se quita la "s" final de plurales simples
 * (vasos → vaso, páginas → página, minutos → minuto); el resto queda igual.
 */
export function unitFor(n: number, unit: string | null): string {
  if (!unit) return '';
  if (n === 1 && /[aiou]s$/i.test(unit)) return unit.slice(0, -1);
  return unit;
}

/** Aviso de un habito medible: cuanto lleva y cuanto falta. */
export function measurableReminderBody(value: number, goal: number, unit: string | null): string {
  const u = unit ? ` ${unitFor(goal, unit)}` : '';
  if (value <= 0) return `Hoy van 0 de ${goal}${u}. Empieza con el primero.`;
  const left = goal - value;
  return `Llevas ${value} de ${goal}${u}: ${left === 1 ? 'te falta 1' : `te faltan ${left}`}.`;
}

/** Aviso de un habito de X veces por semana. */
export function weeklyReminderBody(done: number, target: number): string {
  if (done <= 0) return `Esta semana van 0 de ${target}. Hoy es buen día para empezar.`;
  const left = target - done;
  return `Vas ${done} de ${target} esta semana: ${left === 1 ? 'te falta 1' : `te faltan ${left}`}.`;
}

/** Texto del boton de la notificacion en un medible: "+1 vaso", "+5 minutos". */
export function addActionTitle(step: number, unit: string | null): string {
  const u = unitFor(step, unit);
  return u ? `+${step} ${u}` : `+${step}`;
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
