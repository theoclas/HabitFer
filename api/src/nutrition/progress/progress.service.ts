import { BadRequestException, Injectable } from '@nestjs/common';
import { FoodSource } from '@prisma/client';
import { localTodayKey, parseDateKey, toDateKey } from '../../common/date.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_WATER_GOAL_ML } from '../diary.constants';
import { checkedDate } from '../entry.shared';
import { fastDay, fastState } from '../fasting/fasting';
import { MEAL_ORDER, mealNames } from '../meals';
import { daysBetween, shiftKey } from './days';
import { discoveries } from './discoveries';
import { nutrientGoals } from './goals';
import { monthDays, monthSummary } from './month';
import { buildDays, mealShares, summarize, topFoods, type ReportEntry } from './report';
import { weightTrend } from './trend';

/** Hasta cuántos días cabe en un informe. */
const MAX_RANGE_DAYS = 92;
/** Días que miran los descubrimientos (terminan ayer: hoy aún no termina). */
const DISCOVERY_DAYS = 28;

/** Gráficos, informe de la semana y descubrimientos. */
@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  private async load(userId: string, from: string, to: string) {
    const [entries, profile] = await Promise.all([
      this.prisma.mealEntry.findMany({
        where: { userId, date: { gte: checkedDate(from), lte: checkedDate(to) } },
        select: { date: true, meal: true, foodId: true, name: true, kcal: true, protein: true, fat: true, carbs: true, fiber: true, sugar: true, sodium: true },
      }),
      this.prisma.nutritionProfile.findUnique({ where: { userId } }),
    ]);
    const rows: ReportEntry[] = entries.map((e) => ({ ...e, date: toDateKey(e.date) }));
    const targets = profile
      ? { kcal: profile.kcalTarget, protein: profile.proteinTarget, fat: profile.fatTarget, carbs: profile.carbsTarget, ...nutrientGoals(profile.kcalTarget) }
      : null;
    return { rows, targets, names: mealNames(profile?.mealNames) };
  }

  /** Informe de un periodo (una semana, un mes): cada día, promedios, días en meta, por comida y lo que más aportó. */
  async report(userId: string, from: string, to: string) {
    if (from > to) throw new BadRequestException('La fecha inicial va antes de la final.');
    if (daysBetween(from, to) >= MAX_RANGE_DAYS) throw new BadRequestException(`El informe cubre hasta ${MAX_RANGE_DAYS} días.`);
    const { rows, targets, names } = await this.load(userId, from, to);
    const days = buildDays(rows, from, to);
    return {
      from,
      to,
      today: localTodayKey(),
      targets,
      mealNames: names,
      days,
      summary: summarize(days, targets),
      meals: mealShares(days).map((m) => ({ ...m, name: names[m.slot] })),
      topFoods: topFoods(rows),
    };
  }

  /** «Tu mes en comida»: lo más repetido, días en meta, la mejor semana, el peso y los ayunos de un mes. */
  async month(userId: string, month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('El mes debe venir como AAAA-MM.');
    const today = localTodayKey();
    const { from, to } = monthDays(month, today);
    if (from > today) throw new BadRequestException('Ese mes aún no llega.');
    const start = parseDateKey(from);
    const end = parseDateKey(to);
    const [entries, profile, weights, water, fasts] = await Promise.all([
      this.prisma.mealEntry.findMany({
        where: { userId, date: { gte: start, lte: end } },
        select: {
          date: true,
          meal: true,
          foodId: true,
          name: true,
          kcal: true,
          protein: true,
          fat: true,
          carbs: true,
          fiber: true,
          sugar: true,
          sodium: true,
          food: { select: { source: true } },
        },
      }),
      this.prisma.nutritionProfile.findUnique({ where: { userId } }),
      this.prisma.bodyWeight.findMany({ where: { userId, date: { gte: parseDateKey(shiftKey(from, -60)), lte: end } }, orderBy: { date: 'asc' } }),
      this.prisma.nutritionDay.findMany({ where: { userId, date: { gte: start, lte: end } } }),
      this.prisma.fast.findMany({ where: { userId, endedAt: { not: null }, startedAt: { gte: new Date(start.getTime() - 3 * 86_400_000) } } }),
    ]);
    const rows: ReportEntry[] = entries.map(({ food: _food, ...e }) => ({ ...e, date: toDateKey(e.date) }));
    const targets = profile ? { kcal: profile.kcalTarget, protein: profile.proteinTarget, ...nutrientGoals(profile.kcalTarget) } : null;
    const now = new Date();
    const reached = fasts.filter((f) => {
      const day = fastDay(f, now);
      return day >= from && day <= to && fastState(f, now).reached;
    });
    const summary = monthSummary({
      month,
      days: buildDays(rows, from, to),
      entries: entries.map((e) => ({
        date: toDateKey(e.date),
        foodId: e.foodId,
        name: e.name,
        kcal: e.kcal,
        isDish: e.food?.source === FoodSource.DISH || e.food?.source === FoodSource.RECIPE,
      })),
      targets,
      trend: weightTrend(weights.map((w) => ({ date: toDateKey(w.date), kg: w.kg }))),
      water: water.map((w) => ({ date: toDateKey(w.date), ml: w.waterMl })),
      waterGoalMl: profile?.waterGoalMl ?? DEFAULT_WATER_GOAL_ML,
      fastsReached: reached.length,
      longestFastHours: reached.reduce((m, f) => Math.max(m, fastState(f, now).hours), 0),
    });
    // Los meses con algo anotado, para pasar de uno a otro.
    const first = await this.prisma.mealEntry.findFirst({ where: { userId }, orderBy: { date: 'asc' }, select: { date: true } });
    return { ...summary, from, to, today, firstMonth: first ? toDateKey(first.date).slice(0, 7) : null, kcalTarget: targets?.kcal ?? null };
  }

  /** Descubrimientos de las últimas 4 semanas. */
  async discoveries(userId: string) {
    const today = localTodayKey();
    const from = shiftKey(today, -DISCOVERY_DAYS);
    const to = shiftKey(today, -1);
    const { rows, targets, names } = await this.load(userId, from, to);
    const days = buildDays(rows, from, to);
    return {
      from,
      to,
      loggedDays: days.filter((d) => d.entries > 0).length,
      items: discoveries(days, targets, topFoods(rows), names),
      meals: MEAL_ORDER.map((slot) => ({ slot, name: names[slot] })),
    };
  }
}
