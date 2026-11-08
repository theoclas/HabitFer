import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type MealEntry, type MealSlot } from '@prisma/client';
import { addDays, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { checkedDate, computeOr400, entryView, FOOD_FOR_ENTRY, fromTemplate, totalsOf, type FoodRow, type Template } from './entry.shared';
import { amountText } from './entry.utils';
import { MEAL_ORDER, mealNames } from './meals';
import type { BatchEntriesDto, CopyDto, CreateEntryDto, QuickEntryDto, RepeatEntryDto, UpdateEntryDto, WaterDto } from './nutrition.dto';
import { roundTotals, scale, sumTotals } from './nutrition-math';
import { normalize } from './search.utils';
import { habitualSuggestions, previousMeals } from './suggest.utils';

/** Agua por defecto: 8 vasos de 250 ml. */
export const DEFAULT_WATER_GOAL_ML = 2000;
export const DEFAULT_GLASS_ML = 250;
/** Días hacia atrás para saber «lo de siempre». */
const HABIT_WINDOW_DAYS = 14;
/** Hasta cuántos días atrás se ofrece «repetir lo de ayer». */
const REPEAT_WINDOW_DAYS = 7;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** El diario: lo que se anotó cada día, por comidas, con sus sumas, la meta, el agua y sugerencias. */
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

  async day(userId: string, dateKey: string) {
    const date = checkedDate(dateKey);
    const weekFrom = addDays(date, -6);
    const [entries, past, profile, extra, weekRows, photos] = await Promise.all([
      this.prisma.mealEntry.findMany({ where: { userId, date }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.mealEntry.findMany({
        where: { userId, date: { gte: addDays(date, -HABIT_WINDOW_DAYS), lt: date } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 2000,
      }),
      this.prisma.nutritionProfile.findUnique({ where: { userId } }),
      this.prisma.nutritionDay.findUnique({ where: { userId_date: { userId, date } } }),
      this.prisma.mealEntry.groupBy({
        by: ['date'],
        where: { userId, date: { gte: weekFrom, lte: date } },
        _sum: { kcal: true },
        _count: { _all: true },
      }),
      // Fotos pendientes (sin los bytes: el teléfono las pide aparte).
      this.prisma.mealPhoto.findMany({
        where: { userId, date },
        orderBy: { createdAt: 'asc' },
        select: { id: true, meal: true, note: true, createdAt: true },
      }),
    ]);
    const weekBy = new Map(weekRows.map((r) => [toDateKey(r.date), r]));
    /** Los 7 días que terminan en este (para la tira de la semana). */
    const week = Array.from({ length: 7 }, (_, i) => {
      const key = toDateKey(addDays(weekFrom, i));
      const row = weekBy.get(key);
      return { date: key, kcal: Math.round(row?._sum.kcal ?? 0), count: row?._count._all ?? 0 };
    });
    const names = mealNames(profile?.mealNames);
    const history = past.map((e) => ({ ...e, date: toDateKey(e.date) }));
    const habitual = habitualSuggestions(
      history,
      entries.map((e) => ({ meal: e.meal, foodId: e.foodId })),
    );
    const previous = previousMeals(history, toDateKey(addDays(date, -REPEAT_WINDOW_DAYS)));
    const meals = MEAL_ORDER.map((slot) => {
      const list = entries.filter((e) => e.meal === slot);
      return {
        slot,
        name: names[slot],
        entries: list.map(entryView),
        totals: roundTotals(sumTotals(list.map(totalsOf))),
        /** Lo de siempre en esta comida que aún no está anotado (se confirma con un toque). */
        suggestions: (habitual.get(slot) ?? []).map(({ template: t, days }) => ({
          entryId: t.id,
          foodId: t.foodId,
          name: t.name,
          amount: amountText(t),
          kcal: Math.round(t.kcal),
          days,
        })),
        /** La última vez que esta comida tuvo algo (para «repetir lo de ayer»). */
        previous: previous.meals.get(slot) ?? null,
        /** Fotos para anotar después. */
        photos: photos
          .filter((p) => p.meal === slot)
          .map((p) => ({ id: p.id, note: p.note, createdAt: p.createdAt.toISOString() })),
      };
    });
    return {
      date: dateKey,
      meals,
      totals: roundTotals(sumTotals(entries.map(totalsOf))),
      targets: profile
        ? { kcal: profile.kcalTarget, protein: profile.proteinTarget, fat: profile.fatTarget, carbs: profile.carbsTarget }
        : null,
      /** El último día con algo anotado antes de este (para repetir el día entero). */
      previousDay: previous.day,
      week,
      water: {
        ml: extra?.waterMl ?? 0,
        goalMl: profile?.waterGoalMl ?? DEFAULT_WATER_GOAL_ML,
        glassMl: profile?.glassMl ?? DEFAULT_GLASS_ML,
      },
    };
  }

  async add(userId: string, dto: CreateEntryDto) {
    const date = checkedDate(dto.date);
    const food = await this.loadFood(userId, dto.foodId);
    const v = computeOr400(food, dto);
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
        prep: v.prep,
        oilGrams: v.oilGrams,
      },
    });
    return entryView(created);
  }

  /**
   * Varias anotaciones de una vez (lo que se confirmó de «escribe o dicta»), cada una en su comida.
   * Guarda los nombres aprendidos (la frase que se corrigió → el alimento elegido) y, si venía de una
   * foto pendiente, la borra. Todo o nada.
   */
  async addMany(userId: string, dto: BatchEntriesDto) {
    const date = checkedDate(dto.date);
    const ids = [...new Set(dto.items.map((i) => i.foodId))];
    const foods = await this.prisma.food.findMany({
      where: { id: { in: ids }, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: FOOD_FOR_ENTRY,
    });
    const byId = new Map(foods.map((f) => [f.id, f]));
    const base = Date.now();
    const entries = dto.items.map((item, i) => {
      const food = byId.get(item.foodId);
      if (!food) throw new NotFoundException('Uno de los alimentos ya no existe.');
      const v = computeOr400(food, item);
      const data: Prisma.MealEntryUncheckedCreateInput = {
        userId,
        date,
        meal: item.meal,
        foodId: food.id,
        name: v.name,
        portionLabel: v.portionLabel,
        portionGrams: v.portionGrams,
        quantity: v.quantity,
        grams: v.grams,
        ...v.totals,
        parts: v.parts ?? Prisma.DbNull,
        prep: v.prep,
        oilGrams: v.oilGrams,
        // Un milisegundo de diferencia para que se queden en el orden en que se dijeron.
        createdAt: new Date(base + i),
      };
      return this.prisma.mealEntry.create({ data });
    });
    // Solo se aprenden nombres de alimentos que están en lo que se guarda.
    const aliases = (dto.aliases ?? [])
      .map((a) => ({ phrase: normalize(a.phrase).slice(0, 120), foodId: a.foodId }))
      .filter((a) => a.phrase && byId.has(a.foodId))
      .map((a) =>
        this.prisma.foodAlias.upsert({
          where: { userId_phrase: { userId, phrase: a.phrase } },
          create: { userId, phrase: a.phrase, foodId: a.foodId },
          update: { foodId: a.foodId, uses: { increment: 1 } },
        }),
      );
    const photo = dto.photoId ? [this.prisma.mealPhoto.deleteMany({ where: { id: dto.photoId, userId } })] : [];
    const results = await this.prisma.$transaction([...entries, ...aliases, ...photo]);
    const created = results.slice(0, entries.length) as MealEntry[];
    return { entries: created.map(entryView), kcal: Math.round(created.reduce((s, e) => s + e.kcal, 0)) };
  }

  /** Solo un número de calorías (y los macros que se sepan), sin buscar el alimento. */
  async addQuick(userId: string, dto: QuickEntryDto) {
    const date = checkedDate(dto.date);
    const created = await this.prisma.mealEntry.create({
      data: {
        userId,
        date,
        meal: dto.meal,
        quick: true,
        name: dto.name?.trim() || 'Registro rápido',
        quantity: 1,
        kcal: Math.round(dto.kcal),
        protein: r1(dto.protein ?? 0),
        fat: r1(dto.fat ?? 0),
        carbs: r1(dto.carbs ?? 0),
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

    const manual = dto.name !== undefined || dto.kcal !== undefined || dto.protein !== undefined || dto.fat !== undefined || dto.carbs !== undefined;
    if (entry.quick) {
      if (dto.name !== undefined) data.name = dto.name.trim() || 'Registro rápido';
      if (dto.kcal !== undefined) data.kcal = Math.round(dto.kcal);
      if (dto.protein !== undefined) data.protein = r1(dto.protein);
      if (dto.fat !== undefined) data.fat = r1(dto.fat);
      if (dto.carbs !== undefined) data.carbs = r1(dto.carbs);
      return entryView(await this.prisma.mealEntry.update({ where: { id: entry.id }, data }));
    }
    if (manual) throw new BadRequestException('Las calorías a mano solo se cambian en un registro rápido.');

    const amountChanged =
      dto.quantity !== undefined ||
      dto.grams !== undefined ||
      dto.portionId !== undefined ||
      dto.parts !== undefined ||
      dto.prep !== undefined ||
      dto.oilGrams !== undefined;
    if (amountChanged) {
      const food = entry.foodId
        ? await this.prisma.food.findFirst({ where: { id: entry.foodId, OR: [{ ownerId: null }, { ownerId: userId }] }, include: FOOD_FOR_ENTRY })
        : null;
      if (food) {
        const savedParts = Array.isArray(entry.parts) ? (entry.parts as { partId?: string; included?: boolean; grams?: number }[]) : [];
        const prep = dto.prep !== undefined ? dto.prep : entry.prep;
        const v = computeOr400(food, {
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
          prep,
          // Quitar la preparación quita también su aceite.
          oilGrams: dto.oilGrams !== undefined ? dto.oilGrams : dto.prep === null ? null : entry.oilGrams,
        });
        Object.assign(data, {
          name: v.name,
          portionLabel: v.portionLabel,
          portionGrams: v.portionGrams,
          quantity: v.quantity,
          grams: v.grams,
          ...v.totals,
          parts: v.parts ?? Prisma.DbNull,
          prep: v.prep,
          oilGrams: v.oilGrams,
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

  /** Borrar varias de una vez (deshacer lo que se acaba de agregar, vaciar una comida). */
  async removeMany(userId: string, ids: string[]) {
    const { count } = await this.prisma.mealEntry.deleteMany({ where: { userId, id: { in: ids } } });
    return { removed: count };
  }

  /**
   * Anota de nuevo cada plantilla en su día y comida, en el mismo orden. Devuelve lo anotado.
   * Lo usan repetir, copiar y las comidas guardadas.
   */
  async cloneInto(userId: string, items: { template: Template; date: Date; meal: MealSlot }[]) {
    if (items.length === 0) return [];
    const ids = [...new Set(items.map((i) => i.template.foodId).filter((x): x is string => !!x))];
    const foods = ids.length
      ? await this.prisma.food.findMany({ where: { id: { in: ids }, OR: [{ ownerId: null }, { ownerId: userId }] }, include: FOOD_FOR_ENTRY })
      : [];
    const byId = new Map(foods.map((f) => [f.id, f]));
    const base = Date.now();
    const rows = await this.prisma.$transaction(
      items.map(({ template, date, meal }, i) => {
        const data: Prisma.MealEntryUncheckedCreateInput = {
          ...fromTemplate(template, template.foodId ? byId.get(template.foodId) : undefined),
          userId,
          date,
          meal,
          // Un milisegundo de diferencia para que se queden en el mismo orden.
          createdAt: new Date(base + i),
        };
        return this.prisma.mealEntry.create({ data });
      }),
    );
    return rows.map(entryView);
  }

  /** Volver a anotar algo que ya se anotó (los recientes y «lo de siempre»). */
  async repeat(userId: string, id: string, dto: RepeatEntryDto) {
    const entry = await this.prisma.mealEntry.findFirst({ where: { id, userId } });
    if (!entry) throw new NotFoundException('Esa anotación no existe.');
    const [created] = await this.cloneInto(userId, [{ template: entry, date: checkedDate(dto.date), meal: dto.meal }]);
    return created;
  }

  /** Copiar una comida (o el día entero) a otro día y, si se quiere, a otra comida. */
  async copy(userId: string, dto: CopyDto) {
    const from = checkedDate(dto.fromDate);
    const to = checkedDate(dto.toDate);
    if (dto.toMeal && !dto.fromMeal) throw new BadRequestException('Para copiar a otra comida, elige qué comida copiar.');
    const toMeal = dto.toMeal ?? dto.fromMeal;
    if (dto.fromDate === dto.toDate && (!dto.fromMeal || toMeal === dto.fromMeal)) {
      throw new BadRequestException('Elige otro día u otra comida para copiar.');
    }
    const sources = await this.prisma.mealEntry.findMany({
      where: { userId, date: from, ...(dto.fromMeal ? { meal: dto.fromMeal } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (sources.length === 0) throw new BadRequestException('No hay nada anotado para copiar.');
    const entries = await this.cloneInto(
      userId,
      sources.map((t) => ({ template: t, date: to, meal: toMeal ?? t.meal })),
    );
    return { entries, kcal: Math.round(entries.reduce((s, e) => s + e.kcal, 0)) };
  }

  /** Sumar (o restar) agua del día. */
  async addWater(userId: string, dto: WaterDto) {
    const date = checkedDate(dto.date);
    const key = { userId_date: { userId, date } };
    const current = await this.prisma.nutritionDay.findUnique({ where: key });
    const ml = Math.max(0, Math.min(20000, (current?.waterMl ?? 0) + dto.deltaMl));
    await this.prisma.nutritionDay.upsert({ where: key, create: { userId, date, waterMl: ml }, update: { waterMl: ml } });
    return { date: dto.date, ml };
  }
}
