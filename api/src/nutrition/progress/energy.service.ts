import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type NutritionProfile } from '@prisma/client';
import { localTodayKey, parseDateKey, toDateKey } from '../../common/date.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { computeTargets, type ProfileInput } from '../nutrition-math';
import { mondayOf, shiftKey } from './days';
import { estimateExpenditure, WINDOW_DAYS, type DayIntake } from './expenditure';
import { weightTrend, type WeighIn } from './trend';

/** El ajuste de la meta en la revisión de esta semana (para avisarlo en «Hoy»). */
export type WeekAdjust = { weekStart: string; before: number; after: number; observed: number | null; formula: number };

/** Pesadas de más atrás para la tendencia del peso de la fórmula. */
const WEIGHT_LOOKBACK_DAYS = 120;
/** La tendencia solo reemplaza el peso del perfil si hay una pesada en las últimas 2 semanas. */
const RECENT_WEIGHT_DAYS = 14;
/** Cambio de la meta desde el que se avisa en «Hoy». */
const MIN_NOTICE_KCAL = 25;

const inputOf = (p: NutritionProfile, weightKg = p.weightKg): ProfileInput => ({
  sex: p.sex,
  birthYear: p.birthYear,
  heightCm: p.heightCm,
  weightKg,
  activity: p.activity,
  goal: p.goal,
  ratePerWeek: p.ratePerWeek,
});

/**
 * Meta que se ajusta sola. Cada semana (la primera vez que se abre la app desde el lunes) se revisa la meta:
 * con el peso de tendencia y, cuando hay 2 semanas o más de peso y comida, con el gasto real medido.
 * Sin cron: se hace al leer el día.
 */
@Injectable()
export class EnergyService {
  private readonly logger = new Logger(EnergyService.name);
  /** Semanas ya revisadas en este proceso: «usuario:lunes» → ajuste (o null). */
  private reviewed = new Map<string, WeekAdjust | null>();

  constructor(private prisma: PrismaService) {}

  /** Olvidar lo revisado de un usuario (al cambiar su meta, para que la próxima lectura lo vea). */
  forget(userId: string) {
    for (const key of this.reviewed.keys()) if (key.startsWith(`${userId}:`)) this.reviewed.delete(key);
  }

  /** Revisa la semana si aún no se ha hecho y devuelve el ajuste de esta semana, si cambió la meta. */
  async ensureWeekly(userId: string, today = localTodayKey()): Promise<WeekAdjust | null> {
    const weekStart = mondayOf(today);
    const key = `${userId}:${weekStart}`;
    if (this.reviewed.has(key)) return this.reviewed.get(key) ?? null;
    const profile = await this.prisma.nutritionProfile.findUnique({ where: { userId } });
    let row = await this.prisma.energyEstimate.findUnique({ where: { userId_weekStart: { userId, weekStart: parseDateKey(weekStart) } } });
    if (!row && profile && profile.adaptive && !profile.manual) {
      try {
        row = await this.review(profile, today, weekStart);
      } catch (err) {
        // Dos lecturas a la vez el lunes: la otra ya la guardó.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        row = await this.prisma.energyEstimate.findUnique({ where: { userId_weekStart: { userId, weekStart: parseDateKey(weekStart) } } });
      }
    }
    // Solo se avisa si el cambio se nota (los de pocos kilos de tendencia mueven la meta unas 10 kcal).
    const adjust =
      row && profile?.adaptive && !profile.manual && Math.abs(row.kcalTarget - row.kcalBefore) >= MIN_NOTICE_KCAL
        ? { weekStart, before: row.kcalBefore, after: row.kcalTarget, observed: row.observed, formula: row.formula }
        : null;
    this.reviewed.set(key, adjust);
    return adjust;
  }

  private async load(userId: string, today: string) {
    const [weightRows, intakeRows, previous] = await Promise.all([
      this.prisma.bodyWeight.findMany({
        where: { userId, date: { gte: parseDateKey(shiftKey(today, -WEIGHT_LOOKBACK_DAYS)), lte: parseDateKey(today) } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.mealEntry.groupBy({
        by: ['date'],
        where: { userId, date: { gte: parseDateKey(shiftKey(today, -WINDOW_DAYS)), lt: parseDateKey(today) } },
        _sum: { kcal: true },
        _count: { _all: true },
      }),
      this.prisma.energyEstimate.findFirst({ where: { userId, weekStart: { lt: parseDateKey(mondayOf(today)) } }, orderBy: { weekStart: 'desc' } }),
    ]);
    const weights: WeighIn[] = weightRows.map((r) => ({ date: toDateKey(r.date), kg: r.kg }));
    const intake: DayIntake[] = intakeRows.map((r) => ({ date: toDateKey(r.date), kcal: r._sum.kcal ?? 0, entries: r._count._all }));
    return { weights, intake, previous };
  }

  /** El peso para la fórmula: la tendencia si hay una pesada reciente; si no, el del perfil. */
  private formulaWeight(weights: WeighIn[], today: string, fallback: number) {
    const trend = weightTrend(weights);
    const last = trend[trend.length - 1];
    return last && last.date >= shiftKey(today, -RECENT_WEIGHT_DAYS) ? Math.round(last.trend * 10) / 10 : fallback;
  }

  private async review(profile: NutritionProfile, today: string, weekStart: string) {
    const { weights, intake, previous } = await this.load(profile.userId, today);
    const weightKg = this.formulaWeight(weights, today, profile.weightKg);
    const formula = computeTargets(inputOf(profile, weightKg));
    const est = estimateExpenditure({ today, intake, weights, formulaTdee: formula.tdee, previousTdee: previous?.tdee ?? null });
    const t = computeTargets(inputOf(profile, weightKg), undefined, est.tdee);
    const [row] = await this.prisma.$transaction([
      this.prisma.energyEstimate.create({
        data: {
          userId: profile.userId,
          weekStart: parseDateKey(weekStart),
          tdee: est.tdee,
          formula: est.formula,
          observed: est.observed,
          intakeAvg: est.intakeAvg,
          trendChange: est.trendChange,
          loggedDays: est.loggedDays,
          spanDays: est.spanDays,
          weightKg,
          kcalBefore: profile.kcalTarget,
          kcalTarget: t.kcal,
        },
      }),
      this.prisma.nutritionProfile.update({
        where: { userId: profile.userId },
        data: { weightKg, kcalTarget: t.kcal, proteinTarget: t.protein, fatTarget: t.fat, carbsTarget: t.carbs },
      }),
    ]);
    this.logger.log(`Meta revisada (${weekStart}): ${profile.kcalTarget} → ${t.kcal} kcal (${est.status})`);
    return row;
  }

  /** El gasto de esta semana si ya se midió con datos (para guardar el perfil sin perder el ajuste). */
  async measuredThisWeek(userId: string, today = localTodayKey()): Promise<number | null> {
    const row = await this.prisma.energyEstimate.findUnique({
      where: { userId_weekStart: { userId, weekStart: parseDateKey(mondayOf(today)) } },
    });
    return row && row.observed != null ? row.tdee : null;
  }

  /** Para Progreso y Meta: cómo va la medición hoy y las revisiones de las últimas semanas. */
  async view(userId: string) {
    const profile = await this.prisma.nutritionProfile.findUnique({ where: { userId } });
    if (!profile) return null;
    const today = localTodayKey();
    const [{ weights, intake, previous }, history] = await Promise.all([
      this.load(userId, today),
      this.prisma.energyEstimate.findMany({ where: { userId }, orderBy: { weekStart: 'desc' }, take: 8 }),
    ]);
    const weightKg = this.formulaWeight(weights, today, profile.weightKg);
    const formula = computeTargets(inputOf(profile, weightKg));
    const live = estimateExpenditure({ today, intake, weights, formulaTdee: formula.tdee, previousTdee: previous?.tdee ?? null });
    return {
      adaptive: profile.adaptive,
      manual: profile.manual,
      live,
      nextReview: shiftKey(mondayOf(today), 7),
      history: history.map((h) => ({
        weekStart: toDateKey(h.weekStart),
        tdee: h.tdee,
        formula: h.formula,
        observed: h.observed,
        weightKg: h.weightKg,
        kcalBefore: h.kcalBefore,
        kcalTarget: h.kcalTarget,
        loggedDays: h.loggedDays,
        spanDays: h.spanDays,
      })),
    };
  }
}
