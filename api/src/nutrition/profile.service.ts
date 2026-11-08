import { Injectable } from '@nestjs/common';
import type { NutritionProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_MEAL_NAMES, MEAL_ORDER, mealNames } from './meals';
import type { ProfileDto } from './nutrition.dto';
import { ACTIVITY_LEVELS, computeTargets, type ProfileInput } from './nutrition-math';

function view(p: NutritionProfile) {
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
    targets: { kcal: p.kcalTarget, protein: p.proteinTarget, fat: p.fatTarget, carbs: p.carbsTarget },
    suggested,
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
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    const p = await this.prisma.nutritionProfile.findUnique({ where: { userId } });
    return { profile: p ? view(p) : null, mealNames: mealNames(p?.mealNames), activityLevels: ACTIVITY_LEVELS };
  }

  preview(dto: ProfileInput) {
    return computeTargets(dto);
  }

  async save(userId: string, dto: ProfileDto) {
    const current = await this.prisma.nutritionProfile.findUnique({ where: { userId }, select: { mealNames: true } });
    const t = computeTargets(dto);
    const manual = dto.manual === true;
    const values = {
      sex: dto.sex,
      birthYear: dto.birthYear,
      heightCm: dto.heightCm,
      weightKg: dto.weightKg,
      activity: dto.activity,
      goal: dto.goal,
      ratePerWeek: dto.ratePerWeek,
      manual,
      kcalTarget: manual ? (dto.kcalTarget ?? t.kcal) : t.kcal,
      proteinTarget: manual ? (dto.proteinTarget ?? t.protein) : t.protein,
      fatTarget: manual ? (dto.fatTarget ?? t.fat) : t.fat,
      carbsTarget: manual ? (dto.carbsTarget ?? t.carbs) : t.carbs,
    };
    const names = cleanMealNames(dto.mealNames, current?.mealNames);
    await this.prisma.nutritionProfile.upsert({
      where: { userId },
      create: { userId, ...values, ...(names !== undefined ? { mealNames: names } : {}) },
      update: { ...values, ...(names !== undefined ? { mealNames: names } : {}) },
    });
    return this.get(userId);
  }
}
