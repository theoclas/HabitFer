import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../push/push.service';
import { NutriHabitsService } from '../habits/nutri-habits.service';
import { FAST_PLANS, fastState, fastStreaks, MAX_GOAL_HOURS, MIN_GOAL_HOURS, type FastRow } from './fasting';

const HOUR = 3_600_000;
/** Un ayuno puede empezar hasta 2 días atrás (si se olvidó tocar «Empezar»). */
const MAX_BACK_MS = 48 * HOUR;
const DEFAULT_GOAL = 16;

const view = (f: FastRow, now: Date) => {
  const s = fastState(f, now);
  return {
    id: f.id,
    startedAt: f.startedAt.toISOString(),
    endedAt: f.endedAt?.toISOString() ?? null,
    goalHours: f.goalHours,
    goalAt: s.goalAt.toISOString(),
    hours: Math.round(s.hours * 10) / 10,
    reached: s.reached,
  };
};

/** Ayuno intermitente: un temporizador con la meta elegida (16:8, 18:6…), su racha y un aviso al llegar. */
@Injectable()
export class FastingService {
  private readonly logger = new Logger(FastingService.name);
  private checking = false;

  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private nutriHabits: NutriHabitsService,
  ) {}

  private parseInstant(value: string | undefined, now: Date, label: string): Date {
    if (!value) return now;
    const t = new Date(value);
    if (Number.isNaN(t.getTime())) throw new BadRequestException(`La hora de ${label} no es válida.`);
    if (t.getTime() > now.getTime() + 60_000) throw new BadRequestException(`La hora de ${label} no puede ser en el futuro.`);
    return t;
  }

  private checkGoal(goal: number | undefined, fallback: number) {
    const g = goal ?? fallback;
    if (!Number.isInteger(g) || g < MIN_GOAL_HOURS || g > MAX_GOAL_HOURS) {
      throw new BadRequestException(`La meta del ayuno va de ${MIN_GOAL_HOURS} a ${MAX_GOAL_HOURS} horas.`);
    }
    return g;
  }

  async view(userId: string) {
    const now = new Date();
    const [profile, fasts] = await Promise.all([
      this.prisma.nutritionProfile.findUnique({ where: { userId }, select: { fastGoalHours: true, fastNotify: true } }),
      this.prisma.fast.findMany({ where: { userId }, orderBy: { startedAt: 'desc' }, take: 120 }),
    ]);
    const current = fasts.find((f) => f.endedAt === null) ?? null;
    const streaks = fastStreaks(fasts, now);
    return {
      now: now.toISOString(),
      goalHours: profile?.fastGoalHours ?? DEFAULT_GOAL,
      notify: profile?.fastNotify ?? true,
      /** Hay perfil para guardar la meta y el aviso (si no, cada ayuno lleva su meta). */
      canSaveSettings: profile !== null,
      plans: FAST_PLANS,
      current: current ? view(current, now) : null,
      streak: streaks.current,
      best: streaks.best,
      history: fasts
        .filter((f) => f.endedAt !== null)
        .slice(0, 14)
        .map((f) => view(f, now)),
    };
  }

  async start(userId: string, dto: { startedAt?: string; goalHours?: number }) {
    const now = new Date();
    const open = await this.prisma.fast.findFirst({ where: { userId, endedAt: null } });
    if (open) throw new BadRequestException('Ya hay un ayuno en curso.');
    const startedAt = this.parseInstant(dto.startedAt, now, 'inicio');
    if (now.getTime() - startedAt.getTime() > MAX_BACK_MS) throw new BadRequestException('El ayuno puede empezar hasta 2 días atrás.');
    const profile = await this.prisma.nutritionProfile.findUnique({ where: { userId }, select: { fastGoalHours: true } });
    const goalHours = this.checkGoal(dto.goalHours, profile?.fastGoalHours ?? DEFAULT_GOAL);
    await this.prisma.fast.create({ data: { userId, startedAt, goalHours } });
    return this.view(userId);
  }

  async stop(userId: string, dto: { endedAt?: string }) {
    const now = new Date();
    const open = await this.prisma.fast.findFirst({ where: { userId, endedAt: null } });
    if (!open) throw new BadRequestException('No hay un ayuno en curso.');
    const endedAt = this.parseInstant(dto.endedAt, now, 'fin');
    if (endedAt <= open.startedAt) throw new BadRequestException('El fin tiene que ser después del inicio.');
    await this.prisma.fast.update({ where: { id: open.id }, data: { endedAt } });
    await this.nutriHabits.syncRecent(userId, now);
    return this.view(userId);
  }

  /** Corregir las horas o la meta de un ayuno. */
  async update(userId: string, id: string, dto: { startedAt?: string; endedAt?: string; goalHours?: number }) {
    const now = new Date();
    const f = await this.prisma.fast.findFirst({ where: { id, userId } });
    if (!f) throw new NotFoundException('Ese ayuno no existe.');
    const startedAt = dto.startedAt ? this.parseInstant(dto.startedAt, now, 'inicio') : f.startedAt;
    const endedAt = dto.endedAt ? this.parseInstant(dto.endedAt, now, 'fin') : f.endedAt;
    if (endedAt && endedAt <= startedAt) throw new BadRequestException('El fin tiene que ser después del inicio.');
    if (endedAt && endedAt.getTime() - startedAt.getTime() > MAX_GOAL_HOURS * 2 * HOUR) {
      throw new BadRequestException('Un ayuno tan largo no parece real: revisa las horas.');
    }
    const goalHours = this.checkGoal(dto.goalHours, f.goalHours);
    await this.prisma.fast.update({ where: { id }, data: { startedAt, endedAt, goalHours } });
    await this.nutriHabits.syncRecent(userId, now);
    return this.view(userId);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.fast.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException('Ese ayuno no existe.');
    await this.nutriHabits.syncRecent(userId);
    return this.view(userId);
  }

  /** La meta de siempre y el aviso (en el perfil de la meta). */
  async settings(userId: string, dto: { goalHours?: number; notify?: boolean }) {
    const profile = await this.prisma.nutritionProfile.findUnique({ where: { userId }, select: { fastGoalHours: true } });
    if (!profile) throw new BadRequestException('Primero arma tu meta en NutriFer › Meta.');
    await this.prisma.nutritionProfile.update({
      where: { userId },
      data: {
        ...(dto.goalHours !== undefined ? { fastGoalHours: this.checkGoal(dto.goalHours, profile.fastGoalHours) } : {}),
        ...(dto.notify !== undefined ? { fastNotify: dto.notify } : {}),
      },
    });
    return this.view(userId);
  }

  /** Cada minuto: avisa a quien llegó a su meta de ayuno (una sola vez) y marca su hábito, si está conectado. */
  @Cron(CronExpression.EVERY_MINUTE)
  async notifyReached() {
    if (this.checking) return;
    this.checking = true;
    try {
      const now = new Date();
      const open = await this.prisma.fast.findMany({ where: { endedAt: null, notifiedAt: null }, take: 500 });
      for (const f of open) {
        if (!fastState(f, now).reached) continue;
        await this.prisma.fast.update({ where: { id: f.id }, data: { notifiedAt: now } });
        const profile = await this.prisma.nutritionProfile.findUnique({ where: { userId: f.userId }, select: { fastNotify: true } });
        if (profile?.fastNotify !== false) {
          await this.push
            .sendToUser(f.userId, {
              title: `¡${f.goalHours} horas de ayuno!`,
              body: 'Llegaste a tu meta. Cuando comas, toca «Terminar ayuno» en NutriFer.',
              tag: `nutrifer-fast-${f.id}`,
              url: '/app/nutrifer',
            })
            .catch((err: unknown) => this.logger.warn(`No se pudo avisar el ayuno: ${String(err)}`));
        }
        await this.nutriHabits.syncRecent(f.userId, now).catch(() => undefined);
      }
    } finally {
      this.checking = false;
    }
  }
}
