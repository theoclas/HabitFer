import { Injectable } from '@nestjs/common';
import type { NutritionProfile, Prisma } from '@prisma/client';
import { localTodayKey, parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_GLASS_ML, DEFAULT_WATER_GOAL_ML } from './diary.service';
import { DEFAULT_MEAL_NAMES, MEAL_ORDER, mealNames } from './meals';
import type { ProfileDto } from './nutrition.dto';
import { ACTIVITY_LEVELS, computeTargets, type ProfileInput } from './nutrition-math';
import { shiftKey } from './progress/days';
import { EnergyService } from './progress/energy.service';
import { nutrientGoals } from './progress/goals';
import { weightTrend } from './progress/trend';

function view(p: NutritionProfile, trendKg: number | null) {
  const suggested = computeTargets(p);
  return {
    sex: p.sex,
    birthYear: p.birthYear,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    activity: p.activity,
    goal: p.goal,
    ratePerWeek: p.ratePerWeek,
    manual: p.manual,
    adaptive: p.adaptive,
    targets: { kcal: p.kcalTarget, protein: p.proteinTarget, fat: p.fatTarget, carbs: p.carbsTarget },
    nutrients: nutrientGoals(p.kcalTarget),
    suggested,
    /** El peso de tendencia de hoy (si hay pesadas recientes). */
    trendKg,
    waterGoalMl: p.waterGoalMl ?? DEFAULT_WATER_GOAL_ML,
    glassMl: p.glassMl ?? DEFAULT_GLASS_ML,
  };
}

/** Solo nombres de comidas conocidas, cortos y distintos del nombre por defecto. */
function cleanMealNames(input: Record<string, string> | undefined, current: unknown): Prisma.InputJsonValue | undefined {
  if (!input) return undefined;
  const base = mealNames(current);
  const out: Record<string, string> = {};
  for (const slot of MEAL_ORDER) {
    const v = typeof input[slot] === 'string' ? input[slot].trim().slice(0, 30) : base[slot];
    if (v && v !== DEFAULT_MEAL_NAMES[slot]) out[slot] = v;
  }
  return out;
}

/** Perfil para calcular la meta (Mifflin-St Jeor) y los nombres de las comidas. */
@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private energy: EnergyService,
  ) {}

  /** La tendencia del peso de hoy, si hubo pesadas en las últimas 2 semanas. */
  private async trendKg(userId: string): Promise<number | null> {
    const today = localTodayKey();
    const rows = await this.prisma.bodyWeight.findMany({
      where: { userId, date: { gte: parseDateKey(shiftKey(today, -90)) } },
      orderBy: { date: 'asc' },
      select: { date: true, kg: true },
    });
    const trend = weightTrend(rows.map((r) => ({ date: toDateKey(r.date), kg: r.kg })));
    const last = trend[trend.length - 1];
    return last && last.date >= shiftKey(today, -14) ? Math.round(last.trend * 10) / 10 : null;
  }

  async get(userId: string) {
    const [p, trendKg] = await Promise.all([this.prisma.nutritionProfile.findUnique({ where: { userId } }), this.trendKg(userId)]);
    return { profile: p ? view(p, trendKg) : null, mealNames: mealNames(p?.mealNames), activityLevels: ACTIVITY_LEVELS };
  }

  /** La meta que saldría al guardar: con el gasto medido de esta semana si la meta se ajusta sola; si no, la fórmula. */
  async preview(userId: string, dto: ProfileInput & { manual?: boolean; adaptive?: boolean }) {
    const formula = computeTargets(dto);
    const measured = !dto.manual && dto.adaptive !== false ? await this.energy.measuredThisWeek(userId) : null;
    return measured != null
      ? { ...computeTargets(dto, undefined, measured), formulaTdee: formula.tdee, measured: true }
      : { ...formula, formulaTdee: formula.tdee, measured: false };
  }

  async save(userId: string, dto: ProfileDto) {
    const current = await this.prisma.nutritionProfile.findUnique({ where: { userId }, select: { mealNames: true, adaptive: true } });
    const manual = dto.manual === true;
    const adaptive = dto.adaptive ?? current?.adaptive ?? true;
    // Si esta semana ya se midió el gasto real, la meta sale de ese gasto (no de la fórmula) aunque cambien los datos.
    const measured = !manual && adaptive ? await this.energy.measuredThisWeek(userId) : null;
    const t = computeTargets(dto, undefined, measured ?? undefined);
    const values = {
      sex: dto.sex,
      birthYear: dto.birthYear,
      heightCm: dto.heightCm,
      weightKg: dto.weightKg,
      activity: dto.activity,
      goal: dto.goal,
      ratePerWeek: dto.ratePerWeek,
      manual,
      adaptive,
      kcalTarget: manual ? (dto.kcalTarget ?? t.kcal) : t.kcal,
      proteinTarget: manual ? (dto.proteinTarget ?? t.protein) : t.protein,
      fatTarget: manual ? (dto.fatTarget ?? t.fat) : t.fat,
      carbsTarget: manual ? (dto.carbsTarget ?? t.carbs) : t.carbs,
      ...(dto.waterGoalMl !== undefined ? { waterGoalMl: dto.waterGoalMl } : {}),
      ...(dto.glassMl !== undefined ? { glassMl: dto.glassMl } : {}),
    };
    const names = cleanMealNames(dto.mealNames, current?.mealNames);
    await this.prisma.nutritionProfile.upsert({
      where: { userId },
      create: { userId, ...values, ...(names !== undefined ? { mealNames: names } : {}) },
      update: { ...values, ...(names !== undefined ? { mealNames: names } : {}) },
    });
    this.energy.forget(userId);
    return this.get(userId);
  }
}
