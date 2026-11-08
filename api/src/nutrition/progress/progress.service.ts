import { BadRequestException, Injectable } from '@nestjs/common';
import { localTodayKey, toDateKey } from '../../common/date.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { checkedDate } from '../entry.shared';
import { MEAL_ORDER, mealNames } from '../meals';
import { daysBetween, shiftKey } from './days';
import { discoveries } from './discoveries';
import { nutrientGoals } from './goals';
import { buildDays, mealShares, summarize, topFoods, type ReportEntry } from './report';

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
