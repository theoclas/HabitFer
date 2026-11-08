import Anthropic from '@anthropic-ai/sdk';
import { HttpException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { HabitKind, ScheduleType, UserStatus, type CoachMessage } from '@prisma/client';
import { addDays, localDayStart, parseDateKey, startOfToday, toDateKey } from '../common/date.utils';
import { milestoneHeadline } from '../habits/achievements.utils';
import { shiftKey } from '../habits/habit-rules';
import { EmailRemindersService } from '../mail/email-reminders.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { loadHistory } from '../stats/history.loader';
import { computeInsights } from '../stats/insights.utils';
import { computeProgress } from '../stats/progress.utils';
import { buildCoachContext, coachWeek, type CoachContext } from './coach-context';
import { COACH_MODEL, COACH_SYSTEM } from './coach.prompt';

/** Primera frase del mensaje, para la notificacion. */
function teaser(text: string): string {
  const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return first.length > 140 ? `${first.slice(0, 137)}…` : first;
}

/**
 * Coach semanal: cada domingo a las 7 p. m. (hora del servidor) lee la semana de cada usuario
 * y le escribe un mensaje corto con Claude. Sin ANTHROPIC_API_KEY queda apagado.
 */
@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);
  private readonly client: Anthropic | null;
  /** Un solo pedido a Claude por usuario a la vez (dos pestañas no pagan dos mensajes). */
  private readonly inFlight = new Map<string, Promise<CoachMessage>>();
  private running = false;

  constructor(
    private prisma: PrismaService,
    private push: PushService,
    config: ConfigService,
    private emails: EmailRemindersService,
  ) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY')?.trim();
    this.client = apiKey ? new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 }) : null;
    if (!this.client) this.logger.log('Coach semanal apagado: falta ANTHROPIC_API_KEY');
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  @Cron('0 0 19 * * 0')
  async weekly() {
    if (!this.client || this.running) return;
    this.running = true;
    try {
      const todayKey = toDateKey(startOfToday());
      const { start } = coachWeek(todayKey);
      const users = await this.prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          coachEnabled: true,
          habits: { some: { archived: false } },
          coachMessages: { none: { weekStart: parseDateKey(start) } },
        },
        select: { id: true },
      });
      for (const u of users) {
        try {
          const msg = await this.generate(u.id, todayKey);
          await this.push.sendToUser(u.id, {
            title: '🔥 Tu coach de la semana',
            body: teaser(msg.text),
            tag: `coach-${start}`,
            url: '/app/habitfer?coach=1',
          });
          await this.emails.coach(u.id, msg.text);
        } catch (err) {
          this.logger.warn(`Coach: no se pudo escribir a ${u.id}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Coach: fallo la ronda del domingo: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private view(m: CoachMessage) {
    return { id: m.id, weekStart: toDateKey(m.weekStart), text: m.text, createdAt: m.createdAt, readAt: m.readAt };
  }

  async state(userId: string) {
    const [user, latest] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { coachEnabled: true } }),
      this.prisma.coachMessage.findFirst({ where: { userId }, orderBy: { weekStart: 'desc' } }),
    ]);
    const optedIn = user?.coachEnabled ?? true;
    const { start } = coachWeek(toDateKey(startOfToday()));
    return {
      enabled: this.enabled,
      optedIn,
      week: start,
      message: latest ? this.view(latest) : null,
      canGenerate: this.enabled && optedIn && (!latest || toDateKey(latest.weekStart) !== start),
    };
  }

  /** Pide el mensaje de esta semana ya (si existe, devuelve el mismo: uno por semana). */
  async generateNow(userId: string) {
    if (!this.client) throw new ServiceUnavailableException('El coach no está activado en este servidor.');
    return this.view(await this.generate(userId, toDateKey(startOfToday())));
  }

  async markRead(userId: string, id: string) {
    const msg = await this.prisma.coachMessage.findFirst({ where: { id, userId } });
    if (!msg) throw new NotFoundException('Mensaje no encontrado');
    if (!msg.readAt) await this.prisma.coachMessage.update({ where: { id }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async setEnabled(userId: string, enabled: boolean) {
    await this.prisma.user.update({ where: { id: userId }, data: { coachEnabled: enabled } });
    return this.state(userId);
  }

  private generate(userId: string, todayKey: string): Promise<CoachMessage> {
    const running = this.inFlight.get(userId);
    if (running) return running;
    const job = this.write(userId, todayKey).finally(() => this.inFlight.delete(userId));
    this.inFlight.set(userId, job);
    return job;
  }

  private async write(userId: string, todayKey: string): Promise<CoachMessage> {
    const { start, end } = coachWeek(todayKey);
    const weekStart = parseDateKey(start);
    const existing = await this.prisma.coachMessage.findUnique({ where: { userId_weekStart: { userId, weekStart } } });
    if (existing) return existing;
    const context = await this.context(userId, start, end, todayKey);
    const answer = await this.ask(context);
    return this.prisma.coachMessage.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: { userId, weekStart, text: answer.text, model: COACH_MODEL, inputTokens: answer.inputTokens, outputTokens: answer.outputTokens },
      update: {},
    });
  }

  private async context(userId: string, start: string, end: string, todayKey: string): Promise<CoachContext> {
    const from = parseDateKey(start);
    const to = parseDateKey(end);
    const range = { gte: localDayStart(from), lt: localDayStart(addDays(to, 1)) };
    const [user, { history }, moods, notes, achievements, challenges] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, username: true } }),
      loadHistory(this.prisma, userId),
      this.prisma.dayMood.findMany({
        where: { userId, date: { gte: parseDateKey(shiftKey(todayKey, -60)) } },
        select: { date: true, mood: true },
      }),
      this.prisma.habitCompletion.findMany({
        where: { userId, date: { gte: from, lte: to }, note: { not: null } },
        orderBy: { date: 'desc' },
        take: 8,
        select: { date: true, note: true, habit: { select: { title: true } } },
      }),
      this.prisma.habitAchievement.findMany({
        where: { userId, unlockedAt: range },
        select: { milestoneDays: true, habit: { select: { title: true, kind: true, scheduleType: true } } },
      }),
      this.prisma.challengeResult.findMany({ where: { userId, wonAt: range }, select: { days: true, habit: { select: { title: true } } } }),
    ]);
    const moodMap = new Map(moods.map((m) => [toDateKey(m.date), m.mood]));
    const now = computeProgress(history, end);
    const before = computeProgress(history, shiftKey(start, -1));
    const kindOf = (h: { kind: HabitKind; scheduleType: ScheduleType }) =>
      h.kind === HabitKind.QUIT ? 'clean' : h.scheduleType === ScheduleType.WEEKLY_COUNT ? 'weeks' : 'days';
    return buildCoachContext({
      name: (user?.fullName?.trim().split(/\s+/)[0] || user?.username || '').slice(0, 40),
      habits: history,
      moods: moodMap,
      notes: notes.filter((n) => n.note?.trim()).map((n) => ({ date: toDateKey(n.date), habit: n.habit.title, note: n.note!.trim() })),
      start,
      end,
      todayKey,
      level: { level: now.level.level, title: now.level.title },
      xpWeek: Math.max(0, now.level.xp - before.level.xp),
      achievements: [
        ...achievements.map((a) => `${a.habit.title}: ${milestoneHeadline(a.milestoneDays, kindOf(a.habit))}`),
        ...challenges.map((c) => `${c.habit.title}: reto de ${c.days} días cumplido`),
      ],
      insights: computeInsights(history, moodMap, todayKey, 3).map((i) => i.title),
    });
  }

  /** Una sola llamada a Claude: el resumen va en JSON y vuelve un mensaje corto. */
  private async ask(context: CoachContext): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    if (!this.client) throw new ServiceUnavailableException('El coach no está activado en este servidor.');
    try {
      const response = await this.client.beta.messages.create({
        model: COACH_MODEL,
        max_tokens: 8000,
        // Si un filtro de seguridad declina, Anthropic reintenta con el modelo que recomienda.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: COACH_SYSTEM,
        messages: [{ role: 'user', content: `Resumen de mi semana en HabitFer (JSON):\n${JSON.stringify(context)}` }],
      });
      if (response.stop_reason === 'refusal') {
        throw new ServiceUnavailableException('El coach no pudo escribir este mensaje. Intenta más tarde.');
      }
      const text = response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('\n')
        .trim();
      if (!text) throw new ServiceUnavailableException('El coach se quedó sin palabras. Intenta más tarde.');
      return { text: text.slice(0, 2000), inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        this.logger.error('Coach: la llave de Anthropic no es válida o no tiene permiso');
        throw new ServiceUnavailableException('El coach no está bien configurado en el servidor.');
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new ServiceUnavailableException('El coach está ocupado. Intenta en unos minutos.');
      }
      if (err instanceof Anthropic.APIConnectionError) {
        throw new ServiceUnavailableException('No se pudo contactar al coach. Intenta en unos minutos.');
      }
      if (err instanceof Anthropic.APIError) {
        this.logger.error(`Coach: error ${err.status ?? ''} de la API: ${err.message}`);
        throw new ServiceUnavailableException('El coach no pudo escribir ahora. Intenta más tarde.');
      }
      throw err;
    }
  }
}
