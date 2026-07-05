import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderSourceType, TaskStatus } from '@prisma/client';
import { isScheduledDay } from '../habits/habits.utils';
import { PrismaService } from '../prisma/prisma.service';
import { endOfMinute, formatHHmm, startOfMinute, startOfToday } from './reminders.utils';

@Injectable()
export class RemindersService {
  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    await this.dispatchDueReminders(new Date());
  }

  async syncAndList(userId: string) {
    await this.dispatchDueReminders(new Date(), userId);
    return this.listPending(userId);
  }

  async countUnread(userId: string) {
    await this.dispatchDueReminders(new Date(), userId);
    return { count: await this.prisma.reminderLog.count({ where: { userId, readAt: null } }) };
  }

  async listPending(userId: string) {
    const rows = await this.prisma.reminderLog.findMany({
      where: { userId, readAt: null },
      orderBy: { triggerAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      title: r.title,
      body: r.body,
      triggerAt: r.triggerAt,
      createdAt: r.createdAt,
    }));
  }

  async markRead(userId: string, id: string) {
    const row = await this.prisma.reminderLog.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Recordatorio no encontrado');
    await this.prisma.reminderLog.update({ where: { id }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.reminderLog.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  private async dispatchDueReminders(now: Date, userId?: string) {
    const hhmm = formatHHmm(now);
    const today = startOfToday();
    const minuteStart = startOfMinute(now);
    const minuteEnd = endOfMinute(now);

    const habits = await this.prisma.habit.findMany({
      where: {
        reminderEnabled: true,
        reminderTime: hhmm,
        archived: false,
        ...(userId ? { userId } : {}),
      },
      include: { completions: { where: { date: today } } },
    });

    for (const habit of habits) {
      if (!isScheduledDay(habit.scheduleType, habit.scheduleDays, today)) continue;
      if (habit.completions.length > 0) continue;
      await this.createIfNew({
        userId: habit.userId,
        sourceType: ReminderSourceType.HABIT,
        sourceId: habit.id,
        title: habit.title,
        body: 'Es hora de completar tu habito',
        triggerAt: minuteStart,
      });
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        reminderEnabled: true,
        status: { not: TaskStatus.DONE },
        reminderAt: { gte: minuteStart, lt: minuteEnd },
        ...(userId ? { userId } : {}),
      },
    });

    for (const task of tasks) {
      await this.createIfNew({
        userId: task.userId,
        sourceType: ReminderSourceType.TASK,
        sourceId: task.id,
        title: task.title,
        body: 'Recordatorio de tarea',
        triggerAt: minuteStart,
      });
    }
  }

  private async createIfNew(input: {
    userId: string;
    sourceType: ReminderSourceType;
    sourceId: string;
    title: string;
    body: string;
    triggerAt: Date;
  }) {
    const minuteEnd = endOfMinute(input.triggerAt);
    const existing = await this.prisma.reminderLog.findFirst({
      where: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        triggerAt: { gte: input.triggerAt, lt: minuteEnd },
      },
    });
    if (existing) return;

    await this.prisma.reminderLog.create({
      data: {
        userId: input.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        title: input.title,
        body: input.body,
        triggerAt: input.triggerAt,
      },
    });
  }
}
