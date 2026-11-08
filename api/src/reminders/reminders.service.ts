import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderSourceType, TaskStatus } from '@prisma/client';
import { getCurrentStreak, isScheduledDay, toDateKey } from '../habits/habits.utils';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { buildSummaryText, habitReminderBody, habitReminderTimes } from './reminder-text.utils';
import { endOfMinute, formatHHmm, startOfMinute, startOfToday } from './reminders.utils';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  /**
   * El cron y la campana (cada 60 s) pueden revisar el mismo minuto a la vez; en cola
   * nunca crean el mismo recordatorio dos veces ni mandan dos push iguales.
   */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    try {
      await this.dispatchDueReminders(new Date());
    } catch (err) {
      this.logger.error(`Fallo revisando recordatorios: ${(err as Error).message}`);
    }
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

  private dispatchDueReminders(now: Date, userId?: string): Promise<void> {
    const run = this.queue.then(() => this.dispatch(now, userId));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async dispatch(now: Date, userId?: string) {
    const hhmm = formatHHmm(now);
    const today = startOfToday();
    const todayKey = toDateKey(today);
    const minuteStart = startOfMinute(now);
    const minuteEnd = endOfMinute(now);

    // Habitos: cualquiera de sus horas cae en este minuto y aun no se cumplieron hoy.
    const candidates = await this.prisma.habit.findMany({
      where: { reminderEnabled: true, archived: false, ...(userId ? { userId } : {}) },
      select: {
        id: true,
        userId: true,
        title: true,
        icon: true,
        scheduleType: true,
        scheduleDays: true,
        streakEnabled: true,
        reminderEnabled: true,
        reminderTime: true,
        reminderTimes: true,
      },
    });
    const due = candidates.filter(
      (h) => habitReminderTimes(h).includes(hhmm) && isScheduledDay(h.scheduleType, h.scheduleDays, today),
    );

    for (const habit of due) {
      const completions = await this.prisma.habitCompletion.findMany({ where: { habitId: habit.id }, select: { date: true } });
      const keys = new Set(completions.map((c) => toDateKey(c.date)));
      if (keys.has(todayKey)) continue;
      const streak = habit.streakEnabled ? getCurrentStreak(habit.scheduleType, habit.scheduleDays, true, keys, today) : 0;
      const body = habitReminderBody(streak);
      const created = await this.createIfNew({
        userId: habit.userId,
        sourceType: ReminderSourceType.HABIT,
        sourceId: habit.id,
        title: habit.title,
        body,
        triggerAt: minuteStart,
      });
      if (!created) continue;
      await this.push.sendToUser(habit.userId, {
        title: `${habit.icon?.trim() || '🔥'} ${habit.title}`,
        body,
        tag: `habit-${habit.id}`,
        url: '/app/habitfer',
        actions: [
          { action: 'done', title: 'Hecho' },
          { action: 'open', title: 'Abrir' },
        ],
        data: { kind: 'habit', token: this.push.actionToken(habit.userId, 'habit-done', habit.id, todayKey) },
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
      const body = task.dueTime ? `Para las ${task.dueTime}.` : 'Tienes esta tarea pendiente.';
      const created = await this.createIfNew({
        userId: task.userId,
        sourceType: ReminderSourceType.TASK,
        sourceId: task.id,
        title: task.title,
        body,
        triggerAt: minuteStart,
      });
      if (!created) continue;
      await this.push.sendToUser(task.userId, {
        title: `☑️ ${task.title}`,
        body,
        tag: `task-${task.id}`,
        url: '/app/habitfer/tasks',
        actions: [
          { action: 'done', title: 'Hecha' },
          { action: 'open', title: 'Abrir' },
        ],
        data: { kind: 'task', token: this.push.actionToken(task.userId, 'task-done', task.id) },
      });
    }

    // Resumen nocturno: lo que falta hoy y la racha en riesgo.
    const users = await this.prisma.user.findMany({
      where: { habitSummaryTime: hhmm, ...(userId ? { id: userId } : {}) },
      select: { id: true },
    });
    for (const u of users) await this.sendSummary(u.id, today, todayKey, minuteStart);
  }

  private async sendSummary(userId: string, today: Date, todayKey: string, minuteStart: Date) {
    const habits = await this.prisma.habit.findMany({
      where: { userId, archived: false },
      include: { completions: { select: { date: true } } },
    });
    const pending = habits
      .filter((h) => isScheduledDay(h.scheduleType, h.scheduleDays, today))
      .map((h) => {
        const keys = new Set(h.completions.map((c) => toDateKey(c.date)));
        return {
          done: keys.has(todayKey),
          title: h.title,
          streakEnabled: h.streakEnabled,
          streak: getCurrentStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, keys, today),
        };
      })
      .filter((p) => !p.done);

    const text = buildSummaryText(pending);
    if (!text) return;
    const created = await this.createIfNew({
      userId,
      sourceType: ReminderSourceType.SUMMARY,
      sourceId: `summary-${todayKey}`,
      title: text.title,
      body: text.body,
      triggerAt: minuteStart,
    });
    if (created) await this.push.sendToUser(userId, { ...text, tag: `summary-${todayKey}`, url: '/app/habitfer' });
  }

  /** Crea el recordatorio si no existe uno igual en este minuto. Devuelve true si lo creo. */
  private async createIfNew(input: {
    userId: string;
    sourceType: ReminderSourceType;
    sourceId: string;
    title: string;
    body: string;
    triggerAt: Date;
  }): Promise<boolean> {
    const minuteEnd = endOfMinute(input.triggerAt);
    const existing = await this.prisma.reminderLog.findFirst({
      where: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        triggerAt: { gte: input.triggerAt, lt: minuteEnd },
      },
    });
    if (existing) return false;

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
    return true;
  }
}
