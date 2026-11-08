import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Habit, ScheduleType, TimeOfDay } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteHabitDto } from './dto/complete-habit.dto';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import {
  getCurrentStreak,
  getLongestStreak,
  isScheduledDay,
  isCompletableDate,
  parseDateKey,
  parseScheduleDays,
  startOfToday,
  toDateKey,
} from './habits.utils';
import { randomInt } from 'crypto';
import { buildDays, earliestKey, toHistoryHabit } from '../stats/history.utils';
import { computeSpecials } from './specials.utils';
import {
  getMilestoneLabel,
  getNextMilestone,
  getStreakMilestones,
  isStreakMilestone,
  PHRASE_COUNT,
} from './achievements.utils';

@Injectable()
export class HabitsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, includeArchived = false) {
    const habits = await this.prisma.habit.findMany({
      where: { userId, archived: includeArchived ? undefined : false },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { completions: { select: { date: true } } },
    });
    return habits.map((h) => this.toView(h));
  }

  async today(userId: string, dateKey?: string) {
    const ref = dateKey ? parseDateKey(dateKey) : startOfToday();
    const habits = await this.prisma.habit.findMany({
      where: { userId, archived: false },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { completions: { select: { date: true, note: true } } },
    });
    const refKey = toDateKey(ref);

    return habits
      .filter((h) => isScheduledDay(h.scheduleType, h.scheduleDays, ref))
      .map((h) => {
        const keys = new Set(h.completions.map((c) => toDateKey(c.date)));
        const base = this.toView(h);
        return {
          ...base,
          scheduledForDate: refKey,
          completedToday: keys.has(refKey),
          currentStreak: getCurrentStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, keys, ref),
          /** Nota del completado de ese dia, si la hay. */
          note: h.completions.find((c) => toDateKey(c.date) === refKey)?.note ?? null,
        };
      });
  }

  async getOne(userId: string, id: string) {
    // Todo el historial: con solo los ultimos 90 completados una racha mayor se cortaba en 90.
    const [habit, notes, totalCompletions] = await Promise.all([
      this.prisma.habit.findFirst({
        where: { id, userId },
        include: { completions: { orderBy: { date: 'desc' }, select: { date: true } } },
      }),
      this.prisma.habitCompletion.findMany({
        where: { habitId: id, userId, note: { not: null } },
        orderBy: { date: 'desc' },
        take: 30,
        select: { date: true, note: true },
      }),
      this.prisma.habitCompletion.count({ where: { habitId: id, userId } }),
    ]);
    if (!habit) throw new NotFoundException('Habito no encontrado');
    return {
      ...this.toView(habit, true),
      totalCompletions,
      recentNotes: notes.filter((n) => n.note?.trim()).map((n) => ({ date: toDateKey(n.date), note: n.note as string })),
    };
  }

  async create(userId: string, dto: CreateHabitDto) {
    const habit = await this.prisma.habit.create({
      data: {
        userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        color: dto.color ?? '#22d3ee',
        icon: dto.icon?.trim() || null,
        scheduleType: dto.scheduleType ?? ScheduleType.DAILY,
        scheduleDays: dto.scheduleDays ?? [1, 2, 3, 4, 5, 6, 7],
        timeOfDay: dto.timeOfDay ?? TimeOfDay.ANYTIME,
        streakEnabled: dto.streakEnabled ?? true,
        reminderEnabled: dto.reminderEnabled ?? false,
        reminderTime: dto.reminderEnabled ? dto.reminderTime ?? null : null,
      },
      include: { completions: { select: { date: true } } },
    });
    return this.toView(habit);
  }

  async update(userId: string, id: string, dto: UpdateHabitDto) {
    await this.ensureOwner(userId, id);
    const habit = await this.prisma.habit.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        color: dto.color,
        icon: dto.icon === undefined ? undefined : dto.icon?.trim() || null,
        scheduleType: dto.scheduleType,
        scheduleDays: dto.scheduleDays,
        timeOfDay: dto.timeOfDay,
        streakEnabled: dto.streakEnabled,
        reminderEnabled: dto.reminderEnabled,
        reminderTime: dto.reminderEnabled === false ? null : dto.reminderTime,
        archived: dto.archived,
      },
      include: { completions: { select: { date: true } } },
    });
    return this.toView(habit);
  }

  async remove(userId: string, id: string) {
    await this.ensureOwner(userId, id);
    await this.prisma.habit.delete({ where: { id } });
    return { ok: true };
  }

  async complete(userId: string, id: string, dto: CompleteHabitDto) {
    const existing = await this.ensureOwner(userId, id);
    const date = dto.date ? parseDateKey(dto.date) : startOfToday();

    if (!isCompletableDate(date)) {
      throw new ForbiddenException('Solo puedes marcar habitos de hoy o de ayer');
    }

    if (!isScheduledDay(existing.scheduleType, existing.scheduleDays, date)) {
      throw new ForbiddenException('Este habito no esta programado para esa fecha');
    }

    await this.prisma.habitCompletion.upsert({
      where: { habitId_date: { habitId: id, date } },
      create: { habitId: id, userId, date, note: dto.note?.trim() || null },
      // Sin `note` en la peticion se conserva la nota que ya tuviera ese dia.
      update: { note: dto.note === undefined ? undefined : dto.note.trim() || null },
    });

    const unlockedAchievement = await this.tryUnlockAchievement(userId, id, date);

    const habit = await this.getOne(userId, id);
    if (!unlockedAchievement) return { habit };

    return {
      habit,
      unlockedAchievement: {
        ...unlockedAchievement,
        habitTitle: habit.title,
        habitColor: habit.color,
        habitIcon: habit.icon,
        label: getMilestoneLabel(unlockedAchievement.milestoneDays),
      },
    };
  }

  private async tryUnlockAchievement(userId: string, habitId: string, refDate: Date) {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId },
      include: { completions: { select: { date: true } } },
    });
    if (!habit?.streakEnabled) return null;

    const keys = new Set(habit.completions.map((c) => toDateKey(c.date)));
    const streak = getCurrentStreak(habit.scheduleType, habit.scheduleDays, habit.streakEnabled, keys, refDate);
    if (!isStreakMilestone(streak)) return null;

    const phraseIndex = randomInt(0, PHRASE_COUNT);

    try {
      return await this.prisma.habitAchievement.create({
        data: { habitId, userId, milestoneDays: streak, phraseIndex },
      });
    } catch {
      return null;
    }
  }

  /** Vitrina: logros ganados de cada habito activo y el siguiente hito con lo que falta. */
  async achievementsSummary(userId: string) {
    const today = startOfToday();
    const todayKey = toDateKey(today);
    const habits = await this.prisma.habit.findMany({
      where: { userId, archived: false },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        completions: { select: { date: true, createdAt: true } },
        achievements: { orderBy: { milestoneDays: 'asc' } },
      },
    });
    const history = habits.map(toHistoryHabit);
    const days = buildDays(history, earliestKey(history, todayKey), todayKey);

    return {
      totalMilestones: getStreakMilestones().length,
      specials: computeSpecials(history, days, todayKey),
      habits: habits.map((h) => {
        const keys = new Set(h.completions.map((c) => toDateKey(c.date)));
        const currentStreak = getCurrentStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, keys, today);
        const next = h.streakEnabled ? getNextMilestone(currentStreak) : null;
        return {
          habit: { id: h.id, title: h.title, color: h.color, icon: h.icon, streakEnabled: h.streakEnabled },
          currentStreak,
          longestStreak: getLongestStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, [...keys]),
          unlocked: h.achievements.map((a) => ({
            id: a.id,
            milestoneDays: a.milestoneDays,
            phraseIndex: a.phraseIndex,
            unlockedAt: a.unlockedAt,
            label: getMilestoneLabel(a.milestoneDays),
          })),
          next: next ? { milestoneDays: next, remaining: next - currentStreak, label: getMilestoneLabel(next) } : null,
        };
      }),
    };
  }

  async listAchievements(userId: string, habitId: string) {
    await this.ensureOwner(userId, habitId);
    return this.prisma.habitAchievement.findMany({
      where: { habitId, userId },
      orderBy: { milestoneDays: 'asc' },
    });
  }

  async uncomplete(userId: string, id: string, dateKey: string) {
    await this.ensureOwner(userId, id);
    const date = parseDateKey(dateKey);
    if (!isCompletableDate(date)) {
      throw new ForbiddenException('Solo puedes marcar habitos de hoy o de ayer');
    }
    await this.prisma.habitCompletion.deleteMany({ where: { habitId: id, userId, date } });
    return this.getOne(userId, id);
  }

  private async ensureOwner(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({ where: { id, userId } });
    if (!habit) throw new NotFoundException('Habito no encontrado');
    return habit;
  }

  private toView(habit: Habit & { completions: { date: Date }[] }, withHistory = false) {
    const completionKeys = habit.completions.map((c) => toDateKey(c.date));
    const keysSet = new Set(completionKeys);
    const today = startOfToday();

    return {
      id: habit.id,
      title: habit.title,
      description: habit.description,
      color: habit.color,
      icon: habit.icon,
      archived: habit.archived,
      scheduleType: habit.scheduleType,
      scheduleDays: parseScheduleDays(habit.scheduleDays),
      timeOfDay: habit.timeOfDay,
      streakEnabled: habit.streakEnabled,
      reminderEnabled: habit.reminderEnabled,
      reminderTime: habit.reminderTime,
      sortOrder: habit.sortOrder,
      createdAt: habit.createdAt,
      updatedAt: habit.updatedAt,
      currentStreak: getCurrentStreak(habit.scheduleType, habit.scheduleDays, habit.streakEnabled, keysSet, today),
      longestStreak: getLongestStreak(habit.scheduleType, habit.scheduleDays, habit.streakEnabled, completionKeys),
      completedToday: keysSet.has(toDateKey(today)),
      scheduledToday: isScheduledDay(habit.scheduleType, habit.scheduleDays, today),
      recentCompletions: withHistory ? [...completionKeys].sort().reverse().slice(0, 120) : undefined,
    };
  }
}
