import { ScheduleType } from '@prisma/client';
import { addDays, toDateKey } from '../common/date.utils';
import { isScheduledDay } from '../habits/habits.utils';

export type PerfectDayHabit = {
  scheduleType: ScheduleType;
  scheduleDays: unknown;
  /** Dia (YYYY-MM-DD, hora local) en que se creo el habito: antes de eso no cuenta como programado. */
  createdKey: string;
  completionKeys: Set<string>;
};

/**
 * Dias perfectos seguidos: dias en que se cumplieron todos los habitos programados.
 * Hoy suma solo si ya esta completo; si aun no, no rompe la racha. Los dias sin
 * habitos programados no suman ni rompen.
 */
export function computePerfectStreak(
  habits: PerfectDayHabit[],
  today: Date,
  maxDays = 400,
): { streak: number; todayPerfect: boolean } {
  if (habits.length === 0) return { streak: 0, todayPerfect: false };
  const earliest = habits.reduce((min, h) => (h.createdKey < min ? h.createdKey : min), habits[0].createdKey);
  const todayKey = toDateKey(today);

  let streak = 0;
  let todayPerfect = false;
  for (let i = 0; i < maxDays; i++) {
    const day = addDays(today, -i);
    const key = toDateKey(day);
    if (key < earliest) break;

    const scheduled = habits.filter((h) => h.createdKey <= key && isScheduledDay(h.scheduleType, h.scheduleDays, day));
    if (scheduled.length === 0) continue;

    const perfect = scheduled.every((h) => h.completionKeys.has(key));
    if (perfect) {
      streak++;
      if (key === todayKey) todayPerfect = true;
    } else if (key !== todayKey) {
      break;
    }
  }
  return { streak, todayPerfect };
}
