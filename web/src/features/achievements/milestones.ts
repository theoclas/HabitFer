export function getStreakMilestones(max = 500): number[] {
  const milestones = [3, 5, 10];
  for (let d = 15; d <= 50; d += 5) milestones.push(d);
  for (let d = 60; d <= max; d += 10) milestones.push(d);
  return milestones;
}

export function getNextMilestone(streak: number): number | null {
  return getStreakMilestones().find((m) => m > streak) ?? null;
}
