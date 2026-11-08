import { HabitKind } from '@prisma/client';
import { countsOn, isDoneOn, shiftKey, type RuleHabit } from '../habits/habit-rules';

/**
 * Dias perfectos seguidos: dias en que se cumplio todo lo que contaba (lo pedido, mas lo flexible
 * que si se hizo). Hoy suma solo si ya esta completo; si aun no, no rompe la racha. Los dias en
 * que nada contaba (sin habitos, todo en pausa o congelado) no suman ni rompen.
 */
export function computePerfectStreak(
  habits: RuleHabit[],
  todayKey: string,
  maxDays = 1500,
): { streak: number; todayPerfect: boolean } {
  const build = habits.filter((h) => h.kind === HabitKind.BUILD);
  if (build.length === 0) return { streak: 0, todayPerfect: false };
  const earliest = build.reduce((min, h) => (h.startKey < min ? h.startKey : min), build[0].startKey);

  let streak = 0;
  let todayPerfect = false;
  let key = todayKey;
  for (let i = 0; i < maxDays && key >= earliest; i++) {
    const counted = build.filter((h) => countsOn(h, key));
    if (counted.length > 0) {
      if (counted.every((h) => isDoneOn(h, key))) {
        streak++;
        if (key === todayKey) todayPerfect = true;
      } else if (key !== todayKey) {
        break;
      }
    }
    key = shiftKey(key, -1);
  }
  return { streak, todayPerfect };
}
