/** Milestones: 3, 5, 10 → +5 until 50 → +10 after 50 */
export function getStreakMilestones(max = 500): number[] {
  const milestones = [3, 5, 10];
  for (let d = 15; d <= 50; d += 5) milestones.push(d);
  for (let d = 60; d <= max; d += 10) milestones.push(d);
  return milestones;
}

export function isStreakMilestone(streak: number): boolean {
  return getStreakMilestones().includes(streak);
}

export function getMilestoneLabel(days: number): string {
  if (days === 3) return "Primer paso";
  if (days === 5) return "Constancia inicial";
  if (days === 10) return "Una semana y mas";
  if (days <= 50) return `${days} dias seguidos`;
  return `${days} dias de disciplina`;
}

export function getNextMilestone(streak: number): number | null {
  return getStreakMilestones().find((m) => m > streak) ?? null;
}

/** De que se trata un hito: racha en dias, en semanas, o dias limpio de un habito para dejar. */
export type MilestoneKind = 'days' | 'weeks' | 'clean';

/** Frase corta del hito segun su tipo. */
export function milestoneLabelFor(n: number, kind: MilestoneKind): string {
  if (kind === 'weeks') {
    if (n === 3) return 'Tres semanas firmes';
    if (n === 5) return 'Mes y algo sin fallar';
    if (n === 10) return 'Diez semanas de constancia';
    return `${n} semanas de constancia`;
  }
  if (kind === 'clean') {
    if (n === 3) return 'Los primeros días limpio';
    if (n === 5) return 'Cinco días sin recaer';
    if (n === 10) return 'Diez días de libertad';
    if (n <= 50) return `${n} días limpio`;
    return `${n} días de libertad`;
  }
  return getMilestoneLabel(n);
}

/** Titular del logro ("12 días de racha", "3 semanas seguidas", "10 días limpio"). */
export function milestoneHeadline(n: number, kind: MilestoneKind): string {
  if (kind === 'weeks') return `${n} semanas seguidas`;
  if (kind === 'clean') return `${n} días limpio`;
  return `${n} días de racha`;
}

/** Debe coincidir con web/src/data/frases_motivacionales.json (solo logros, no banner alterno). */
export const PHRASE_COUNT = 884;
