import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Habit, ScheduleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteHabitDto } from './dto/complete-habit.dto';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import {
  getCurrentStreak,
  getLongestStreak,
  isScheduledDay,
  parseDateKey,
  parseScheduleDays,
  startOfToday,
  toDateKey,
} from './habits.utils';

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
      include: { completions: { select: { date: true } } },
    });

    return habits
      .filter((h) => isScheduledDay(h.scheduleType, h.scheduleDays, ref))
      .map((h) => {
        const keys = new Set(h.completions.map((c) => toDateKey(c.date)));
        const base = this.toView(h);
        return {
          ...base,
          scheduledForDate: toDateKey(ref),
          completedToday: keys.has(toDateKey(ref)),
          currentStreak: getCurrentStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, keys, ref),
        };
      });
  }

  async getOne(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id, userId },
      include: { completions: { orderBy: { date: 'desc' }, take: 90, select: { date: true } } },
    });
    if (!habit) throw new NotFoundException('Habito no encontrado');
    return this.toView(habit, true);
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
    const habit = await this.ensureOwner(userId, id);
    const date = dto.date ? parseDateKey(dto.date) : startOfToday();

    if (!isScheduledDay(habit.scheduleType, habit.scheduleDays, date)) {
      throw new ForbiddenException('Este habito no esta programado para esa fecha');
    }

    await this.prisma.habitCompletion.upsert({
      where: { habitId_date: { habitId: id, date } },
      create: { habitId: id, userId, date, note: dto.note?.trim() || null },
      update: { note: dto.note?.trim() || null },
    });

    return this.getOne(userId, id);
  }

  async uncomplete(userId: string, id: string, dateKey: string) {
    await this.ensureOwner(userId, id);
    const date = parseDateKey(dateKey);
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
      recentCompletions: withHistory ? [...completionKeys].sort().reverse() : undefined,
    };
  }
}
