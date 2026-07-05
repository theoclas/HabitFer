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
