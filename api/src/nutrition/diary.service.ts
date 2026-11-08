import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type MealEntry } from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { amountText, computeEntry, EntryInputError, type EntryInput, type FoodForEntry } from './entry.utils';
import { MEAL_ORDER, mealNames } from './meals';
import type { CreateEntryDto, UpdateEntryDto } from './nutrition.dto';
import { roundTotals, scale, sumTotals, type Totals } from './nutrition-math';

const FOOD_FOR_ENTRY = {
  portions: true,
  parts: { orderBy: { sortOrder: 'asc' }, include: { food: true } },
} satisfies Prisma.FoodInclude;

type FoodRow = Prisma.FoodGetPayload<{ include: typeof FOOD_FOR_ENTRY }>;

function asFood(row: FoodRow): FoodForEntry {
  return {
    id: row.id,
    name: row.name,
    kcal: row.kcal,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    fiber: row.fiber,
    sugar: row.sugar,
    sodium: row.sodium,
    portions: row.portions.map((p) => ({ id: p.id, label: p.label, grams: p.grams, isDefault: p.isDefault })),
    parts: row.parts.map((p) => ({ id: p.id, label: p.label, grams: p.grams, foodId: p.foodId, food: p.food })),
  };
}

function totalsOf(e: Pick<MealEntry, 'kcal' | 'protein' | 'fat' | 'carbs' | 'fiber' | 'sugar' | 'sodium'>): Totals {
  return { kcal: e.kcal, protein: e.protein, fat: e.fat, carbs: e.carbs, fiber: e.fiber ?? 0, sugar: e.sugar ?? 0, sodium: e.sodium ?? 0 };
}

export function entryView(e: MealEntry) {
  return {
    id: e.id,
    date: toDateKey(e.date),
    meal: e.meal,
    foodId: e.foodId,
    name: e.name,
    portionLabel: e.portionLabel,
    portionGrams: e.portionGrams,
    quantity: e.quantity,
    grams: e.grams,
    amount: amountText(e),
    kcal: e.kcal,
    protein: e.protein,
    fat: e.fat,
    carbs: e.carbs,
    fiber: e.fiber,
    sugar: e.sugar,
    sodium: e.sodium,
    parts: e.parts,
  };
}

/** AAAA-MM-DD que exista de verdad (no 2026-02-31) y razonable. */
export function checkedDate(key: string): Date {
  const date = parseDateKey(key);
  if (Number.isNaN(date.getTime()) || toDateKey(date) !== key) throw new BadRequestException('Esa fecha no existe.');
  const year = date.getUTCFullYear();
  if (year < 2000 || year > new Date().getFullYear() + 1) throw new BadRequestException('Esa fecha está fuera de rango.');
  return date;
}

/** El diario: lo que se anotó cada día, por comidas, con sus sumas y la meta. */
@Injectable()
export class DiaryService {
  constructor(private prisma: PrismaService) {}

  private async loadFood(userId: string, foodId: string): Promise<FoodRow> {
    const food = await this.prisma.food.findFirst({
      where: { id: foodId, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: FOOD_FOR_ENTRY,
    });
    if (!food) throw new NotFoundException('Ese alimento no existe.');
    return food;
  }

  private compute(food: FoodRow, input: EntryInput) {
    try {
      return computeEntry(asFood(food), input);
    } catch (err) {
      if (err instanceof EntryInputError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  async day(userId: string, dateKey: string) {
    const date = checkedDate(dateKey);
    const [entries, profile] = await Promise.all([
      this.prisma.mealEntry.findMany({ where: { userId, date }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.nutritionProfile.findUnique({ where: { userId } }),
    ]);
    const names = mealNames(profile?.mealNames);
    const meals = MEAL_ORDER.map((slot) => {
      const list = entries.filter((e) => e.meal === slot);
      return {
        slot,
        name: names[slot],
        entries: list.map(entryView),
        totals: roundTotals(sumTotals(list.map(totalsOf))),
      };
    });
    return {
      date: dateKey,
      meals,
      totals: roundTotals(sumTotals(entries.map(totalsOf))),
      targets: profile
        ? { kcal: profile.kcalTarget, protein: profile.proteinTarget, fat: profile.fatTarget, carbs: profile.carbsTarget }
        : null,
    };
  }

  async add(userId: string, dto: CreateEntryDto) {
    const date = checkedDate(dto.date);
    const food = await this.loadFood(userId, dto.foodId);
    const v = this.compute(food, dto);
    const created = await this.prisma.mealEntry.create({
      data: {
        userId,
        date,
        meal: dto.meal,
        foodId: food.id,
        name: v.name,
        portionLabel: v.portionLabel,
        portionGrams: v.portionGrams,
        quantity: v.quantity,
        grams: v.grams,
        ...v.totals,
        parts: v.parts ?? Prisma.DbNull,
      },
    });
    return entryView(created);
  }

  async update(userId: string, id: string, dto: UpdateEntryDto) {
    const entry = await this.prisma.mealEntry.findFirst({ where: { id, userId } });
    if (!entry) throw new NotFoundException('Esa anotación no existe.');
    const data: Prisma.MealEntryUpdateInput = {};
    if (dto.date) data.date = checkedDate(dto.date);
    if (dto.meal) data.meal = dto.meal;

    const amountChanged = dto.quantity !== undefined || dto.grams !== undefined || dto.portionId !== undefined || dto.parts !== undefined;
    if (amountChanged) {
      const food = entry.foodId
        ? await this.prisma.food.findFirst({ where: { id: entry.foodId, OR: [{ ownerId: null }, { ownerId: userId }] }, include: FOOD_FOR_ENTRY })
        : null;
      if (food) {
        const savedParts = Array.isArray(entry.parts) ? (entry.parts as { partId?: string; included?: boolean; grams?: number }[]) : [];
        const v = this.compute(food, {
          portionId: dto.portionId,
          // Sin medida nueva se queda la que tenía (o sus gramos si se anotó en gramos).
          portionLabel: dto.portionId || dto.grams !== undefined ? undefined : (entry.portionLabel ?? undefined),
          grams: dto.grams ?? (dto.portionId || entry.portionLabel ? undefined : (entry.grams ?? undefined)),
          quantity: dto.quantity ?? (dto.grams !== undefined ? 1 : entry.quantity),
          parts:
            dto.parts ??
            savedParts
              .filter((p) => typeof p.partId === 'string')
              .map((p) => ({ partId: p.partId as string, included: p.included !== false, grams: typeof p.grams === 'number' ? p.grams : undefined })),
        });
        Object.assign(data, {
          name: v.name,
          portionLabel: v.portionLabel,
          portionGrams: v.portionGrams,
          quantity: v.quantity,
          grams: v.grams,
          ...v.totals,
          parts: v.parts ?? Prisma.DbNull,
        });
      } else {
        // El alimento ya no existe: se escalan los valores guardados con la nueva cantidad.
        const oldQ = entry.quantity || 1;
        const newQ = dto.quantity ?? oldQ;
        const factor = dto.grams !== undefined && entry.grams ? dto.grams / entry.grams : newQ / oldQ;
        const t = roundTotals(scale(totalsOf(entry), 100 * factor));
        Object.assign(data, { ...t, quantity: newQ, grams: entry.grams ? Math.round(entry.grams * factor * 10) / 10 : null });
      }
    }
    const saved = await this.prisma.mealEntry.update({ where: { id: entry.id }, data });
    return entryView(saved);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.mealEntry.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Esa anotación no existe.');
    return { ok: true };
  }
}
