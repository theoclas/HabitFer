import { buildDays, earliestKey, type DayRow, type HistoryHabit } from './history.utils';
import { computeXp, freezesEarned, levelFromXp } from './xp.utils';

export type LevelInfo = {
  xp: number;
  todayXp: number;
  level: number;
  title: string;
  levelStartXp: number;
  nextLevelXp: number;
};

/** Historial completo dia a dia, XP, nivel y congeladores ganados. */
export function computeProgress(history: HistoryHabit[], todayKey: string): {
  allDays: DayRow[];
  perfectKeys: string[];
  level: LevelInfo;
  freezesEarned: number;
} {
  const allDays = buildDays(history, earliestKey(history, todayKey), todayKey);
  const perfectKeys = allDays.filter((d) => d.perfect).map((d) => d.date);
  const xp = computeXp(history, perfectKeys, todayKey);
  const lvl = levelFromXp(xp.xp);
  return {
    allDays,
    perfectKeys,
    level: { xp: xp.xp, todayXp: xp.todayXp, ...lvl },
    freezesEarned: freezesEarned(lvl.level),
  };
}
