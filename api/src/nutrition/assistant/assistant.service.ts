import { BadRequestException, Injectable } from '@nestjs/common';
import {
  localTodayKey,
  parseDateKey,
  toDateKey,
} from '../../common/date.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_WATER_GOAL_ML } from '../diary.constants';
import { checkedDate } from '../entry.shared';
import { FastingService } from '../fasting/fasting.service';
import { FoodsService } from '../foods.service';
import { mealNames } from '../meals';
import { SEAL_LABELS } from '../packaged/seals';
import { daysBetween, shiftKey } from '../progress/days';
import { EnergyService } from '../progress/energy.service';
import { ProgressService } from '../progress/progress.service';
import {
  buildAssistantReport,
  type AssistantEntry,
  type AssistantFast,
  type AssistantReport,
} from './assistant-report';

/** Días del informe si no se piden otros. */
export const DEFAULT_REPORT_DAYS = 14;
/** Hasta cuántos días cabe en un informe (igual que el de Progreso). */
export const MAX_REPORT_DAYS = 92;
/** La tendencia del peso arranca este tanto antes, para no empezar «fría». */
const TREND_WARMUP_DAYS = 60;

export type ReportRange = { days?: number; from?: string; to?: string };

/** Partes del plato que se quitaron al anotarlo («sin chicharrón»). */
function skippedParts(parts: unknown): string[] {
  if (!Array.isArray(parts)) return [];
  return parts
    .filter(
      (p): p is { label: string; included: boolean } =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as { label?: unknown }).label === 'string',
    )
    .filter((p) => p.included === false)
    .map((p) => p.label);
}

const fastOf = (f: {
  startedAt: string;
  endedAt: string | null;
  goalHours: number;
  hours: number;
  reached: boolean;
}): AssistantFast => ({
  startedAt: f.startedAt,
  endedAt: f.endedAt,
  goalHours: f.goalHours,
  hours: f.hours,
  reached: f.reached,
});

/** El periodo pedido: los últimos `days` días hasta hoy (o hasta `to`), o de `from` a `to`. Nunca después de hoy. */
export function reportRange(
  q: ReportRange,
  today: string,
): { from: string; to: string } {
  if (q.to) checkedDate(q.to);
  if (q.from) checkedDate(q.from);
  let to = q.to ?? today;
  if (to > today) to = today;
  const from = q.from ?? shiftKey(to, -((q.days ?? DEFAULT_REPORT_DAYS) - 1));
  if (from > to)
    throw new BadRequestException(
      'La fecha inicial va antes de la final (y no después de hoy).',
    );
  if (daysBetween(from, to) >= MAX_REPORT_DAYS)
    throw new BadRequestException(
      `El informe cubre hasta ${MAX_REPORT_DAYS} días.`,
    );
  return { from, to };
}

/** Lo que lee un asistente (Claude) para ayudar con la dieta. Solo lee. */
@Injectable()
export class AssistantService {
  constructor(
    private prisma: PrismaService,
    private progress: ProgressService,
    private energy: EnergyService,
    private fasting: FastingService,
    private foods: FoodsService,
  ) {}

  async report(userId: string, q: ReportRange): Promise<AssistantReport> {
    const today = localTodayKey();
    const { from, to } = reportRange(q, today);
    const start = parseDateKey(from);
    const end = parseDateKey(to);
    const [entries, profile, water, weights, energy, fasting, discoveries] =
      await Promise.all([
        this.prisma.mealEntry.findMany({
          where: { userId, date: { gte: start, lte: end } },
          orderBy: [
            { date: 'asc' },
            { sortOrder: 'asc' },
            { createdAt: 'asc' },
          ],
          select: {
            date: true,
            meal: true,
            foodId: true,
            name: true,
            portionLabel: true,
            quantity: true,
            grams: true,
            kcal: true,
            protein: true,
            fat: true,
            carbs: true,
            fiber: true,
            sugar: true,
            sodium: true,
            quick: true,
            prep: true,
            oilGrams: true,
            parts: true,
            food: { select: { source: true, category: true, brand: true } },
          },
        }),
        this.prisma.nutritionProfile.findUnique({ where: { userId } }),
        this.prisma.nutritionDay.findMany({
          where: { userId, date: { gte: start, lte: end } },
        }),
        this.prisma.bodyWeight.findMany({
          where: {
            userId,
            date: {
              gte: parseDateKey(shiftKey(from, -TREND_WARMUP_DAYS)),
              lte: end,
            },
          },
          orderBy: { date: 'asc' },
        }),
        this.energy.view(userId),
        this.fasting.view(userId),
        this.progress.discoveries(userId),
      ]);

    const rows: AssistantEntry[] = entries.map(
      ({ food, parts, date, ...e }) => ({
        ...e,
        date: toDateKey(date),
        skipped: skippedParts(parts),
        source: food?.source ?? null,
        category: food?.category ?? null,
        brand: food?.brand ?? null,
      }),
    );

    return buildAssistantReport({
      generatedAt: new Date(),
      today,
      from,
      to,
      profile: profile && {
        ...profile,
        waterGoalMl: profile.waterGoalMl ?? DEFAULT_WATER_GOAL_ML,
      },
      mealNames: mealNames(profile?.mealNames),
      entries: rows,
      water: water.map((w) => ({ date: toDateKey(w.date), ml: w.waterMl })),
      weights: weights.map((w) => ({ date: toDateKey(w.date), kg: w.kg })),
      energy: energy && {
        live: energy.live,
        nextReview: energy.nextReview,
        history: energy.history.map((h) => ({
          weekStart: h.weekStart,
          tdee: h.tdee,
          formula: h.formula,
          observed: h.observed,
          kcalBefore: h.kcalBefore,
          kcalTarget: h.kcalTarget,
        })),
      },
      fasting: {
        goalHours: fasting.goalHours,
        streak: fasting.streak,
        best: fasting.best,
        current: fasting.current && fastOf(fasting.current),
        history: fasting.history.map(fastOf),
      },
      discoveries: discoveries.items,
    });
  }

  /** Buscar en la base de NutriFer (la compartida y la propia) con los valores por 100 g y las medidas caseras. */
  async searchFoods(userId: string, q: string, limit: number) {
    const ranked = (await this.foods.search(userId, q)).slice(0, limit);
    const rows = await this.prisma.food.findMany({
      where: { id: { in: ranked.map((r) => r.id) } },
      include: {
        portions: { orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] },
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      query: q,
      results: ranked.flatMap((r) => {
        const f = byId.get(r.id);
        if (!f) return [];
        return [
          {
            id: f.id,
            name: f.name,
            source: f.source,
            category: f.category,
            brand: f.brand,
            own: f.ownerId !== null,
            isDish: r.isDish,
            per100g: {
              kcal: f.kcal,
              protein: f.protein,
              fat: f.fat,
              carbs: f.carbs,
              fiber: f.fiber,
              sugar: f.sugar,
              satFat: f.satFat,
              sodium: f.sodium,
            },
            portions: f.portions.map((p) => ({
              label: p.label,
              grams: p.grams,
              isDefault: p.isDefault,
              kcal: Math.round((f.kcal * p.grams) / 100),
            })),
            seals: r.seals.map((s) => SEAL_LABELS[s]),
          },
        ];
      }),
    };
  }
}
