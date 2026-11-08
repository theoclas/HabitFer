import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import {
  getCurrentStreak,
  getLongestStreak,
  isScheduledDay,
  toDateKey,
} from '../habits/habits.utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildDays,
  byHour,
  byWeekday,
  earliestKey,
  moodSummary,
  ranking,
  toHistoryHabit,
  type HistoryHabit,
} from './history.utils';
import { computePerfectStreak } from './perfect-days.utils';
import { addDays, dayLabel, lastNDays, localDayStart, parseDateKey, startOfToday, toDateKey as statsDateKey } from './stats.utils';
import { computeXp, levelFromXp } from './xp.utils';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;

const COMPLETIONS_SELECT = { completions: { select: { date: true, createdAt: true } } } as const;

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  /** Habitos activos (o uno en concreto, aunque este archivado) con todo su historial. */
  private async loadHistory(userId: string, habitId?: string): Promise<HistoryHabit[]> {
    const habits = await this.prisma.habit.findMany({
      where: habitId ? { userId, id: habitId } : { userId, archived: false },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: COMPLETIONS_SELECT,
    });
    return habits.map(toHistoryHabit);
  }

  async overview(userId: string) {
    const today = startOfToday();
    const todayKey = statsDateKey(today);
    const history = await this.loadHistory(userId);

    const completionByDay = buildDays(history, statsDateKey(addDays(today, -6)), todayKey).map((d) => ({
      date: d.date,
      label: dayLabel(parseDateKey(d.date)),
      scheduled: d.scheduled,
      completed: d.completed,
      rate: d.rate,
    }));

    const keySets = history.map((h) => new Set(h.completions.map((c) => c.key)));
    const topStreaks = history
      .map((h, i) => ({ h, keys: keySets[i] }))
      .filter(({ h }) => h.streakEnabled)
      .map(({ h, keys }) => ({
        id: h.id,
        title: h.title,
        color: h.color,
        currentStreak: getCurrentStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, keys, today),
        longestStreak: getLongestStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, [...keys]),
      }))
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .slice(0, 5);

    const perfect = computePerfectStreak(
      history.map((h, i) => ({
        scheduleType: h.scheduleType,
        scheduleDays: h.scheduleDays,
        createdKey: h.createdKey,
        completionKeys: keySets[i],
      })),
      today,
    );

    const allDays = buildDays(history, earliestKey(history, todayKey), todayKey);
    const xp = computeXp(
      history.map((h) => ({
        scheduleType: h.scheduleType,
        scheduleDays: h.scheduleDays,
        streakEnabled: h.streakEnabled,
        keys: h.completions.map((c) => c.key),
      })),
      allDays.filter((d) => d.perfect).map((d) => d.date),
      todayKey,
    );

    const weekStart = addDays(today, -6);
    const [tasksDoneWeek, tasksOpen, tasksByDay] = await Promise.all([
      this.prisma.task.count({
        where: { userId, status: TaskStatus.DONE, updatedAt: { gte: localDayStart(weekStart) } },
      }),
      this.prisma.task.count({ where: { userId, status: { not: TaskStatus.DONE } } }),
      Promise.all(
        lastNDays(7, today).map(async (day) => {
          const next = addDays(day, 1);
          const count = await this.prisma.task.count({
            where: { userId, status: TaskStatus.DONE, updatedAt: { gte: localDayStart(day), lt: localDayStart(next) } },
          });
          return { date: statsDateKey(day), label: dayLabel(day), completed: count };
        }),
      ),
    ]);

    const totalScheduledWeek = completionByDay.reduce((s, d) => s + d.scheduled, 0);
    const totalCompletedWeek = completionByDay.reduce((s, d) => s + d.completed, 0);

    return {
      habits: {
        active: history.length,
        weekCompletionRate: totalScheduledWeek ? Math.round((totalCompletedWeek / totalScheduledWeek) * 100) : 0,
        daily: completionByDay,
        topStreaks,
        perfectStreak: perfect.streak,
        todayPerfect: perfect.todayPerfect,
        perfectDaysTotal: allDays.filter((d) => d.perfect).length,
        level: { xp: xp.xp, todayXp: xp.todayXp, ...levelFromXp(xp.xp) },
      },
      tasks: {
        open: tasksOpen,
        completedThisWeek: tasksDoneWeek,
        daily: tasksByDay,
      },
    };
  }

  /**
   * Historial de un rango (por defecto los ultimos 30 dias): dia a dia, por dia de la semana,
   * por hora, ranking de habitos y cruce con el animo. Con `habitId` se limita a ese habito.
   */
  async range(userId: string, from?: string, to?: string, habitId?: string) {
    const today = startOfToday();
    const todayKey = statsDateKey(today);
    let toKey = to && DATE_KEY.test(to) ? to : todayKey;
    if (toKey > todayKey) toKey = todayKey;
    let fromKey = from && DATE_KEY.test(from) ? from : statsDateKey(addDays(today, -29));
    if (fromKey > toKey) fromKey = toKey;
    const minFrom = statsDateKey(addDays(parseDateKey(toKey), -(MAX_RANGE_DAYS - 1)));
    if (fromKey < minFrom) fromKey = minFrom;

    const history = await this.loadHistory(userId, habitId);
    if (habitId && history.length === 0) throw new NotFoundException('Habito no encontrado');

    const days = buildDays(history, fromKey, toKey);
    const moodRows = habitId
      ? []
      : await this.prisma.dayMood.findMany({
          where: { userId, date: { gte: parseDateKey(fromKey), lte: parseDateKey(toKey) } },
          select: { date: true, mood: true },
          orderBy: { date: 'asc' },
        });
    const moods = new Map(moodRows.map((m) => [toDateKey(m.date), m.mood]));

    const scheduled = days.reduce((s, d) => s + d.scheduled, 0);
    const completed = days.reduce((s, d) => s + d.completed, 0);

    const streakById = new Map(
      history.map((h) => [
        h.id,
        getCurrentStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, new Set(h.completions.map((c) => c.key)), today),
      ]),
    );

    return {
      from: fromKey,
      to: toKey,
      days,
      byWeekday: byWeekday(days),
      byHour: byHour(history, fromKey, toKey),
      totals: {
        scheduled,
        completed,
        rate: scheduled ? Math.round((completed / scheduled) * 100) : 0,
        perfectDays: days.filter((d) => d.perfect).length,
      },
      ranking: habitId ? [] : ranking(history, fromKey, toKey).map((r) => ({ ...r, currentStreak: streakById.get(r.id) ?? 0 })),
      mood: moodSummary(days, moods),
      moods: [...moods].map(([date, mood]) => ({ date, mood })),
    };
  }

  async habitDetail(userId: string, habitId: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId },
      include: { completions: { orderBy: { date: 'asc' } } },
    });
    if (!habit) throw new NotFoundException('Habito no encontrado');

    const today = startOfToday();
    const days30 = lastNDays(30, today);
    const keys = new Set(habit.completions.map((c) => toDateKey(c.date)));

    let scheduled = 0;
    let completed = 0;
    const calendar = days30.map((day) => {
      const key = statsDateKey(day);
      const isScheduled = isScheduledDay(habit.scheduleType, habit.scheduleDays, day);
      const isDone = keys.has(key);
      if (isScheduled) {
        scheduled++;
        if (isDone) completed++;
      }
      return { date: key, scheduled: isScheduled, completed: isDone };
    });

    return {
      id: habit.id,
      title: habit.title,
      color: habit.color,
      streakEnabled: habit.streakEnabled,
      currentStreak: getCurrentStreak(habit.scheduleType, habit.scheduleDays, habit.streakEnabled, keys, today),
      longestStreak: getLongestStreak(
        habit.scheduleType,
        habit.scheduleDays,
        habit.streakEnabled,
        habit.completions.map((c) => toDateKey(c.date)),
      ),
      completionRate30d: scheduled ? Math.round((completed / scheduled) * 100) : 0,
      calendar,
    };
  }

  async tasksSummary(userId: string) {
    const [todo, inProgress, done, high, medium, low] = await Promise.all([
      this.prisma.task.count({ where: { userId, status: TaskStatus.TODO } }),
      this.prisma.task.count({ where: { userId, status: TaskStatus.IN_PROGRESS } }),
      this.prisma.task.count({ where: { userId, status: TaskStatus.DONE } }),
      this.prisma.task.count({ where: { userId, priority: 'HIGH', status: { not: TaskStatus.DONE } } }),
      this.prisma.task.count({ where: { userId, priority: 'MEDIUM', status: { not: TaskStatus.DONE } } }),
      this.prisma.task.count({ where: { userId, priority: 'LOW', status: { not: TaskStatus.DONE } } }),
    ]);

    const today = startOfToday();
    const weeks = [0, 1, 2, 3].map((w) => {
      const start = addDays(today, -(w + 1) * 7 + 1);
      const end = addDays(today, -w * 7 + 1);
      return { start, end, label: 'Sem ' + (4 - w) };
    });

    const weekly = await Promise.all(
      weeks.map(async (w) => ({
        label: w.label,
        completed: await this.prisma.task.count({
          where: { userId, status: TaskStatus.DONE, updatedAt: { gte: localDayStart(w.start), lt: localDayStart(w.end) } },
        }),
      })),
    );

    return {
      byStatus: { todo, inProgress, done },
      byPriorityOpen: { high, medium, low },
      weeklyCompleted: weekly.reverse(),
    };
  }
}
