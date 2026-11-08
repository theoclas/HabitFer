import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HabitKind, ReminderSourceType, ScheduleType, TaskStatus } from '@prisma/client';
import {
  currentStreak,
  isPlannedOn,
  isRequiredOn,
  weekDoneCount,
  weeklyTargetOf,
  weekStartKey,
} from '../habits/habit-rules';
import { HABIT_FULL_INCLUDE } from '../habits/habit-view';
import { toDateKey } from '../habits/habits.utils';
import { EmailRemindersService } from '../mail/email-reminders.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { WhatsappRemindersService } from '../whatsapp/whatsapp-reminders.service';
import { loadPauses } from '../stats/history.loader';
import { toHistoryHabit, type PauseRange } from '../stats/history.utils';
import {
  addActionTitle,
  buildSummaryText,
  habitReminderBody,
  habitReminderTimes,
  measurableReminderBody,
  weeklyReminderBody,
} from './reminder-text.utils';
import { endOfMinute, formatHHmm, startOfMinute, startOfToday } from './reminders.utils';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  /**
   * El cron y la campana (cada 60 s) pueden revisar el mismo minuto a la vez; en cola
   * nunca crean el mismo recordatorio dos veces ni mandan dos push iguales.
   */
  private queue: Promise<unknown> = Promise.resolve();
  /**
   * Correo y WhatsApp salen en su propia fila, sin frenar la ronda: WhatsApp espera un rato entre
   * mensajes y la campana de la app (que también revisa los avisos) no debe quedarse esperando.
   */
  private outbox: Promise<unknown> = Promise.resolve();

  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private emails: EmailRemindersService,
    private whatsapp: WhatsappRemindersService,
  ) {}

  /** Pone un envío de correo o WhatsApp en la fila (nunca lanza). */
  private later(job: () => Promise<unknown>) {
    this.outbox = this.outbox.then(job).catch((err) => this.logger.warn(`Fallo un aviso externo: ${(err as Error).message}`));
  }

  /** Para las pruebas: espera a que salga lo que está en la fila. */
  flushOutbox(): Promise<unknown> {
    return this.outbox;
  }

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

    // Habitos: una de sus horas cae en este minuto y hoy todavia hace falta.
    const candidates = await this.prisma.habit.findMany({
      where: { reminderEnabled: true, archived: false, kind: HabitKind.BUILD, ...(userId ? { userId } : {}) },
      select: {
        id: true,
        kind: true,
        scheduleType: true,
        scheduleDays: true,
        reminderEnabled: true,
        reminderTime: true,
        reminderTimes: true,
      },
    });
    const due = candidates.filter((h) => habitReminderTimes(h).includes(hhmm) && isPlannedOn(h, todayKey));
    const pausesByUser = new Map<string, PauseRange[]>();

    for (const { id } of due) {
      const habit = await this.prisma.habit.findUnique({ where: { id }, include: HABIT_FULL_INCLUDE });
      if (!habit) continue;
      if (!pausesByUser.has(habit.userId)) pausesByUser.set(habit.userId, await loadPauses(this.prisma, habit.userId));
      const hist = toHistoryHabit(habit, pausesByUser.get(habit.userId)!);
      // Ya cumplido, o hoy en pausa o congelado: nada que recordar.
      if (hist.doneKeys.has(todayKey) || hist.skipKeys.has(todayKey)) continue;

      const measurable = habit.goal > 1;
      let body: string;
      if (habit.scheduleType === ScheduleType.WEEKLY_COUNT) {
        const done = weekDoneCount(hist, weekStartKey(todayKey), todayKey);
        const target = weeklyTargetOf(habit);
        if (done >= target) continue;
        body = weeklyReminderBody(done, target);
      } else if (measurable) {
        const p = await this.prisma.habitProgress.findUnique({
          where: { habitId_date: { habitId: habit.id, date: today } },
        });
        body = measurableReminderBody(p?.value ?? 0, habit.goal, habit.unit);
      } else {
        body = habitReminderBody(habit.streakEnabled ? currentStreak(hist, todayKey) : 0);
      }

      const created = await this.createIfNew({
        userId: habit.userId,
        sourceType: ReminderSourceType.HABIT,
        sourceId: habit.id,
        title: habit.title,
        body,
        triggerAt: minuteStart,
      });
      if (!created) continue;
      const token = this.push.actionToken(habit.userId, measurable ? 'habit-add' : 'habit-done', habit.id, todayKey);
      const addTitle = measurable ? addActionTitle(habit.step, habit.unit) : null;
      await this.push.sendToUser(habit.userId, {
        title: `${habit.icon?.trim() || '🔥'} ${habit.title}`,
        body,
        tag: `habit-${habit.id}`,
        url: '/app/habitfer',
        actions: [
          { action: 'done', title: addTitle ?? 'Hecho' },
          { action: 'open', title: 'Abrir' },
        ],
        data: { kind: 'habit', token },
      });
      // Correo y WhatsApp (si el usuario los pidio): mismo token; el boton abre /accion en la web.
      const external = {
        icon: habit.icon,
        title: habit.title,
        body,
        token,
        actionLabel: addTitle ? addTitle.replace(/^\+/, 'Sumar ') : 'Marcar como hecho',
      };
      const owner = habit.userId;
      this.later(() => this.emails.habit(owner, external));
      this.later(() => this.whatsapp.habit(owner, external));
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
      const token = this.push.actionToken(task.userId, 'task-done', task.id);
      await this.push.sendToUser(task.userId, {
        title: `☑️ ${task.title}`,
        body,
        tag: `task-${task.id}`,
        url: '/app/habitfer/tasks',
        actions: [
          { action: 'done', title: 'Hecha' },
          { action: 'open', title: 'Abrir' },
        ],
        data: { kind: 'task', token },
      });
      const external = { title: task.title, body, token };
      this.later(() => this.emails.task(task.userId, external));
      this.later(() => this.whatsapp.task(task.userId, external));
    }

    // Resumen nocturno: lo que falta hoy y la racha en riesgo.
    const users = await this.prisma.user.findMany({
      where: { habitSummaryTime: hhmm, ...(userId ? { id: userId } : {}) },
      select: { id: true },
    });
    for (const u of users) await this.sendSummary(u.id, today, todayKey, minuteStart);
  }

  /** Lo que se pedia hoy y falta (sin pausas ni congelados; los medibles con su avance). */
  private async sendSummary(userId: string, today: Date, todayKey: string, minuteStart: Date) {
    const [habits, pauses, progress] = await Promise.all([
      this.prisma.habit.findMany({ where: { userId, archived: false, kind: HabitKind.BUILD }, include: HABIT_FULL_INCLUDE }),
      loadPauses(this.prisma, userId),
      this.prisma.habitProgress.findMany({ where: { userId, date: today }, select: { habitId: true, value: true } }),
    ]);
    const valueById = new Map(progress.map((p) => [p.habitId, p.value]));
    const pending = habits
      .map((h) => ({ h, hist: toHistoryHabit(h, pauses) }))
      .filter(({ hist }) => isRequiredOn(hist, todayKey) && !hist.doneKeys.has(todayKey))
      .map(({ h, hist }) => ({
        title: h.goal > 1 ? `${h.title} (${valueById.get(h.id) ?? 0}/${h.goal})` : h.title,
        streakEnabled: h.streakEnabled,
        streak: currentStreak(hist, todayKey),
      }));

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
    if (!created) return;
    await this.push.sendToUser(userId, { ...text, tag: `summary-${todayKey}`, url: '/app/habitfer' });
    // El correo y WhatsApp traen la lista completa (el push solo cabe en dos lineas).
    const digest = {
      ...text,
      items: pending.map((p) =>
        p.streakEnabled && p.streak > 0 ? `${p.title} · racha de ${p.streak} ${p.streak === 1 ? 'día' : 'días'}` : p.title,
      ),
    };
    this.later(() => this.emails.summary(userId, digest));
    this.later(() => this.whatsapp.summary(userId, digest));
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
