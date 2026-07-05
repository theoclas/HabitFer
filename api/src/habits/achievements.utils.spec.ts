import { getStreakMilestones, isStreakMilestone } from './achievements.utils';

describe('achievements.utils', () => {
  it('defines milestones 3, 5, 10 then +5 to 50 then +10', () => {
    const m = getStreakMilestones(100);
    expect(m.slice(0, 11)).toEqual([3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    expect(m.slice(11, 16)).toEqual([60, 70, 80, 90, 100]);
  });

  it('recognizes milestone streaks', () => {
    expect(isStreakMilestone(3)).toBe(true);
    expect(isStreakMilestone(4)).toBe(false);
    expect(isStreakMilestone(50)).toBe(true);
    expect(isStreakMilestone(55)).toBe(false);
    expect(isStreakMilestone(60)).toBe(true);
  });
});
