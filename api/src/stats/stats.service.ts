import { Injectable, NotFoundException } from '@nestjs/common';
import { HabitKind, TaskStatus } from '@prisma/client';
import { countsOn, currentStreak, isDoneOn, longestStreak, shiftKey, streakUnit } from '../habits/habit-rules';
import { PrismaService } from '../prisma/prisma.service';
import { loadHistory } from './history.loader';
import { buildDays, byHour, byWeekday, moodSummary, ranking } from './history.utils';
import { computePerfectStreak } from './perfect-days.utils';
import { computeProgress } from './progress.utils';
import { addDays, dayLabel, lastNDays, localDayStart, parseDateKey, startOfToday, toDateKey } from './stats.utils';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async overview(userId: string) {
    const today = startOfToday();
    const todayKey = toDateKey(today);
    const [{ history, pauses }, freezesUsed] = await Promise.all([
      loadHistory(this.prisma, userId),
      this.prisma.streakFreeze.count({ where: { userId } }),
    ]);

    const completionByDay = buildDays(history, shiftKey(todayKey, -6), todayKey).map((d) => ({
      date: d.date,
      label: dayLabel(parseDateKey(d.date)),
      scheduled: d.scheduled,
      completed: d.completed,
      rate: d.rate,
    }));

    const topStreaks = history
      .filter((h) => h.kind === HabitKind.BUILD && h.streakEnabled)
      .map((h) => ({
        id: h.id,
        title: h.title,
        color: h.color,
        currentStreak: currentStreak(h, todayKey),
        longestStreak: longestStreak(h, todayKey),
        streakUnit: streakUnit(h),
      }))
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .slice(0, 5);

    const perfect = computePerfectStreak(history, todayKey);
    const progress = computeProgress(history, todayKey);
    const general = pauses.filter((p) => p.habitId === null && p.endKey >= todayKey);
    const activePause = general.find((p) => p.startKey <= todayKey) ?? null;
    const nextPause = general.find((p) => p.startKey > todayKey) ?? null;
    const pauseOut = (p: (typeof general)[number] | null) =>
      p ? { id: p.id, startDate: p.startKey, endDate: p.endKey, note: p.note } : null;

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
          return { date: toDateKey(day), label: dayLabel(day), completed: count };
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
        perfectDaysTotal: progress.perfectKeys.length,
        level: progress.level,
        freezes: {
          earned: progress.freezesEarned,
          used: freezesUsed,
          available: Math.max(0, progress.freezesEarned - freezesUsed),
        },
        /** Pausa de todos los habitos que cubre hoy (vacaciones). */
        pause: pauseOut(activePause),
        nextPause: pauseOut(nextPause),
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
   * por hora, ranking de habitos y cruce con el animo. Con `habitId` se limita a ese habito
   * (si es para dejar algo, cada dia limpio cuenta como cumplido).
   */
  async range(userId: string, from?: string, to?: string, habitId?: string) {
    const today = startOfToday();
    const todayKey = toDateKey(today);
    let toKey = to && DATE_KEY.test(to) ? to : todayKey;
    if (toKey > todayKey) toKey = todayKey;
    let fromKey = from && DATE_KEY.test(from) ? from : shiftKey(todayKey, -29);
    if (fromKey > toKey) fromKey = toKey;
    const minFrom = shiftKey(toKey, -(MAX_RANGE_DAYS - 1));
    if (fromKey < minFrom) fromKey = minFrom;

    const { history } = await loadHistory(this.prisma, userId, { habitId });
    if (habitId && history.length === 0) throw new NotFoundException('Habito no encontrado');

    const days = buildDays(history, fromKey, toKey, { quitAsClean: Boolean(habitId) });
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
    const byId = new Map(history.map((h) => [h.id, h]));

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
      ranking: habitId
        ? []
        : ranking(history, fromKey, toKey).map((r) => {
            const h = byId.get(r.id)!;
            return { ...r, currentStreak: currentStreak(h, todayKey), streakUnit: streakUnit(h) };
          }),
      mood: moodSummary(days, moods),
      moods: [...moods].map(([date, mood]) => ({ date, mood })),
    };
  }

  async habitDetail(userId: string, habitId: string) {
    const { history } = await loadHistory(this.prisma, userId, { habitId });
    const h = history[0];
    if (!h) throw new NotFoundException('Habito no encontrado');

    const todayKey = toDateKey(startOfToday());
    let scheduled = 0;
    let completed = 0;
    const calendar = Array.from({ length: 30 }, (_, i) => shiftKey(todayKey, i - 29)).map((key) => {
      const isScheduled = countsOn(h, key);
      const isDone = isDoneOn(h, key);
      if (isScheduled) {
        scheduled++;
        if (isDone) completed++;
      }
      return { date: key, scheduled: isScheduled, completed: isDone };
    });

    return {
      id: h.id,
      title: h.title,
      color: h.color,
      streakEnabled: h.streakEnabled,
      currentStreak: currentStreak(h, todayKey),
      longestStreak: longestStreak(h, todayKey),
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
