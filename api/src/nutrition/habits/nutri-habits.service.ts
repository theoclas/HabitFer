import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { HabitKind } from '@prisma/client';
import { localTodayKey, parseDateKey } from '../../common/date.utils';
import { HabitsService } from '../../habits/habits.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_GLASS_ML, DEFAULT_WATER_GOAL_ML } from '../diary.constants';
import { reachedByDay } from '../fasting/fasting';
import { shiftKey } from '../progress/days';
import { AUTO_DEFAULTS, AUTO_SOURCES, autoValue, isAutoSource, type AutoSource, type DayFacts } from './auto-values';

const HABIT_SELECT = { id: true, title: true, icon: true, color: true, goal: true, unit: true, autoSource: true } as const;

/**
 * Conexión con HabitFer: hábitos que se marcan solos con lo de NutriFer (anotar las comidas, la proteína,
 * el agua y el ayuno). Solo hoy y ayer, como al marcar a mano.
 */
@Injectable()
export class NutriHabitsService {
  constructor(
    private prisma: PrismaService,
    private habits: HabitsService,
  ) {}

  /** Las cuatro conexiones (con su hábito, si hay) y los hábitos que se pueden conectar. */
  async list(userId: string) {
    const all = await this.prisma.habit.findMany({
      where: { userId, archived: false, kind: HabitKind.BUILD },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: HABIT_SELECT,
    });
    return {
      sources: AUTO_SOURCES.map((source) => ({
        source,
        title: AUTO_DEFAULTS[source].title,
        description: AUTO_DEFAULTS[source].description,
        icon: AUTO_DEFAULTS[source].icon,
        habit: all.find((h) => h.autoSource === source) ?? null,
      })),
      habits: all.filter((h) => !isAutoSource(h.autoSource)),
    };
  }

  private async ownBuildHabit(userId: string, habitId: string) {
    const h = await this.prisma.habit.findFirst({ where: { id: habitId, userId, archived: false } });
    if (!h) throw new NotFoundException('Ese hábito no existe.');
    if (h.kind === HabitKind.QUIT) throw new BadRequestException('Un hábito para dejar algo no se puede marcar solo.');
    return h;
  }

  /** Conectar un hábito que ya existe (o desconectar con null). */
  async link(userId: string, source: AutoSource, habitId: string | null) {
    if (habitId) await this.ownBuildHabit(userId, habitId);
    await this.prisma.$transaction([
      this.prisma.habit.updateMany({ where: { userId, autoSource: source }, data: { autoSource: null } }),
      ...(habitId ? [this.prisma.habit.update({ where: { id: habitId }, data: { autoSource: source } })] : []),
    ]);
    await this.syncRecent(userId);
    return this.list(userId);
  }

  /** Crear el hábito en HabitFer, ya conectado. */
  async create(userId: string, source: AutoSource) {
    const d = AUTO_DEFAULTS[source];
    const [profile, last] = await Promise.all([
      this.prisma.nutritionProfile.findUnique({ where: { userId }, select: { waterGoalMl: true, glassMl: true } }),
      this.prisma.habit.aggregate({ where: { userId }, _max: { sortOrder: true } }),
    ]);
    const glasses = Math.round((profile?.waterGoalMl ?? DEFAULT_WATER_GOAL_ML) / (profile?.glassMl ?? DEFAULT_GLASS_ML));
    await this.prisma.$transaction([
      this.prisma.habit.updateMany({ where: { userId, autoSource: source }, data: { autoSource: null } }),
      this.prisma.habit.create({
        data: {
          userId,
          title: d.title,
          description: d.description,
          icon: d.icon,
          color: d.color,
          goal: source === 'NUTRI_WATER' ? Math.max(1, glasses) : d.goal,
          unit: d.unit,
          step: 1,
          autoSource: source,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
        },
      }),
    ]);
    await this.syncRecent(userId);
    return this.list(userId);
  }

  /** Lo que pasó en NutriFer ese día, para los hábitos. */
  private async facts(userId: string, dateKey: string, now: Date): Promise<DayFacts> {
    const date = parseDateKey(dateKey);
    const [entries, profile, day, fasts] = await Promise.all([
      this.prisma.mealEntry.findMany({ where: { userId, date }, select: { meal: true, protein: true } }),
      this.prisma.nutritionProfile.findUnique({ where: { userId }, select: { proteinTarget: true, waterGoalMl: true, glassMl: true } }),
      this.prisma.nutritionDay.findUnique({ where: { userId_date: { userId, date } } }),
      this.prisma.fast.findMany({ where: { userId, startedAt: { gte: new Date(date.getTime() - 4 * 86_400_000) } } }),
    ]);
    return {
      mealsLogged: new Set(entries.map((e) => e.meal)).size,
      protein: entries.reduce((s, e) => s + e.protein, 0),
      proteinTarget: profile?.proteinTarget ?? null,
      waterMl: day?.waterMl ?? 0,
      waterGoalMl: profile?.waterGoalMl ?? DEFAULT_WATER_GOAL_ML,
      glassMl: profile?.glassMl ?? DEFAULT_GLASS_ML,
      fastHours: reachedByDay(fasts, now).get(dateKey) ?? 0,
    };
  }

  /** Marca los hábitos conectados de un día (hoy o ayer) con lo de NutriFer. No hace nada si no hay conectados. */
  async syncDay(userId: string, dateKey: string, now = new Date()) {
    const today = localTodayKey();
    if (dateKey !== today && dateKey !== shiftKey(today, -1)) return;
    const linked = await this.prisma.habit.findMany({
      where: { userId, archived: false, autoSource: { not: null } },
      select: { id: true, goal: true, autoSource: true },
    });
    if (linked.length === 0) return;
    const f = await this.facts(userId, dateKey, now);
    for (const h of linked) {
      if (isAutoSource(h.autoSource)) await this.habits.syncAutoValue(userId, h.id, dateKey, autoValue(h.autoSource, h.goal, f));
    }
  }

  /** Hoy y ayer. */
  async syncRecent(userId: string, now = new Date()) {
    const today = localTodayKey();
    await this.syncDay(userId, shiftKey(today, -1), now);
    await this.syncDay(userId, today, now);
  }
}
