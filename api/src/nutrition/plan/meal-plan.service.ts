import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FoodSource, PlanKind, type MealSlot } from '@prisma/client';
import { toDateKey } from '../../common/date.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { DiaryService } from '../diary.service';
import { checkedDate } from '../entry.shared';
import { mealNames } from '../meals';
import { SavedMealsService } from '../saved-meals.service';
import { daysBetween, eachDay, shiftKey } from '../progress/days';
import { shoppingList, type Ingredient } from './shopping';

const PORTIONS = { select: { label: true, grams: true, isDefault: true }, orderBy: [{ isDefault: 'desc' as const }, { sortOrder: 'asc' as const }] };
const FOOD_SELECT = {
  id: true,
  name: true,
  source: true,
  category: true,
  kcal: true,
  servings: true,
  cookedGrams: true,
  ownerId: true,
  portions: PORTIONS,
  parts: { select: { foodId: true, grams: true } },
  ingredients: { select: { foodId: true, grams: true } },
} as const;

type FoodPlanRow = {
  id: string;
  name: string;
  source: FoodSource;
  category: string | null;
  kcal: number;
  servings: number | null;
  cookedGrams: number | null;
  ownerId: string | null;
  portions: { label: string; grams: number; isDefault: boolean }[];
  parts: { foodId: string; grams: number }[];
  ingredients: { foodId: string; grams: number }[];
};

/** Una pieza de compra todavía sin nombre (el nombre y la categoría se buscan al final, de una vez). */
type RawIngredient = { foodId: string; grams: number };

const r0 = (n: number) => Math.round(n);

/** Gramos de una porción de receta: la olla cocida (o la suma de lo crudo) entre las porciones. */
function recipeServingGrams(f: FoodPlanRow): number {
  const pot = f.cookedGrams ?? f.ingredients.reduce((s, i) => s + i.grams, 0);
  const portion = f.portions[0]?.grams;
  return portion && portion > 0 ? portion : pot / Math.max(1, f.servings ?? 1);
}

/** Lo que lleva un alimento en `grams` gramos (los platos y recetas se abren en sus ingredientes). */
function expandFood(f: FoodPlanRow, grams: number): RawIngredient[] {
  if (f.source === FoodSource.RECIPE && f.ingredients.length) {
    const pot = f.cookedGrams ?? f.ingredients.reduce((s, i) => s + i.grams, 0);
    const share = pot > 0 ? grams / pot : 0;
    return f.ingredients.map((i) => ({ foodId: i.foodId, grams: i.grams * share }));
  }
  if (f.parts.length) {
    const plate = f.parts.reduce((s, p) => s + p.grams, 0);
    const share = plate > 0 ? grams / plate : 0;
    return f.parts.map((p) => ({ foodId: p.foodId, grams: p.grams * share }));
  }
  return [{ foodId: f.id, grams }];
}

/** Plan de la semana con las comidas guardadas, recetas y alimentos; de ahí sale la lista de mercado. */
@Injectable()
export class MealPlanService {
  constructor(
    private prisma: PrismaService,
    private diary: DiaryService,
    private saved: SavedMealsService,
  ) {}

  private async foods(userId: string, ids: string[]): Promise<Map<string, FoodPlanRow>> {
    if (!ids.length) return new Map();
    const rows = await this.prisma.food.findMany({
      where: { id: { in: [...new Set(ids)] }, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: FOOD_SELECT,
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** La semana desde `from` (siete días): lo planeado con sus calorías, el total de cada día y la lista de mercado. */
  async week(userId: string, from: string) {
    const start = checkedDate(from);
    const to = shiftKey(from, 6);
    const [items, profile] = await Promise.all([
      this.prisma.mealPlanItem.findMany({
        where: { userId, date: { gte: start, lte: checkedDate(to) } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.nutritionProfile.findUnique({ where: { userId }, select: { kcalTarget: true, mealNames: true } }),
    ]);
    const savedIds = items.filter((i) => i.kind === PlanKind.SAVED).map((i) => i.refId);
    const savedMeals = savedIds.length
      ? await this.prisma.savedMeal.findMany({
          where: { id: { in: [...new Set(savedIds)] }, userId },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        })
      : [];
    const savedBy = new Map(savedMeals.map((s) => [s.id, s]));
    const foodIds = items.filter((i) => i.kind !== PlanKind.SAVED).map((i) => i.refId);
    const itemFoodIds = savedMeals.flatMap((s) => s.items.map((i) => i.foodId).filter((x): x is string => !!x));
    const foodsBy = await this.foods(userId, [...foodIds, ...itemFoodIds]);

    const raw: RawIngredient[] = [];
    const view = items.map((it) => {
      const date = toDateKey(it.date);
      if (it.kind === PlanKind.SAVED) {
        const s = savedBy.get(it.refId);
        if (!s) return { id: it.id, date, meal: it.meal, kind: it.kind, refId: it.refId, servings: it.servings, name: 'Comida guardada que ya no existe', kcal: 0, missing: true };
        for (const item of s.items) {
          if (item.quick || !item.foodId) continue;
          const parts = Array.isArray(item.parts) ? (item.parts as { foodId?: string; grams?: number; included?: boolean }[]) : null;
          if (parts?.length) {
            for (const p of parts) if (p.included !== false && p.foodId && p.grams) raw.push({ foodId: p.foodId, grams: p.grams * it.servings });
            continue;
          }
          const grams = item.grams ?? (item.portionGrams ?? 0) * item.quantity;
          const f = foodsBy.get(item.foodId);
          raw.push(...(f ? expandFood(f, grams * it.servings) : [{ foodId: item.foodId, grams: grams * it.servings }]));
        }
        return { id: it.id, date, meal: it.meal, kind: it.kind, refId: it.refId, servings: it.servings, name: s.name, kcal: r0(s.items.reduce((t, i) => t + i.kcal, 0) * it.servings), missing: false };
      }
      const f = foodsBy.get(it.refId);
      if (!f) return { id: it.id, date, meal: it.meal, kind: it.kind, refId: it.refId, servings: it.servings, name: 'Alimento que ya no existe', kcal: 0, missing: true };
      const grams = (f.source === FoodSource.RECIPE ? recipeServingGrams(f) : (f.portions[0]?.grams ?? 100)) * it.servings;
      raw.push(...expandFood(f, grams));
      return {
        id: it.id,
        date,
        meal: it.meal,
        kind: it.kind,
        refId: it.refId,
        servings: it.servings,
        name: f.name,
        /** La medida: «1 porción», «2 × arepa pequeña». */
        unit: f.source === FoodSource.RECIPE ? 'porción' : (f.portions[0]?.label ?? '100 g'),
        kcal: r0((f.kcal * grams) / 100),
        missing: false,
      };
    });

    // Nombres, categorías y medidas de lo que hay que comprar.
    const ingredientFoods = await this.foods(userId, raw.map((r) => r.foodId));
    const ingredients: Ingredient[] = raw.flatMap((r) => {
      const f = ingredientFoods.get(r.foodId);
      if (!f) return [];
      const unit = f.portions[0] ? { label: f.portions[0].label, grams: f.portions[0].grams } : null;
      return [{ foodId: f.id, name: f.name, category: f.category, grams: r.grams, unit }];
    });

    return {
      from,
      to,
      mealNames: mealNames(profile?.mealNames),
      kcalTarget: profile?.kcalTarget ?? null,
      items: view,
      days: eachDay(from, to).map((date) => ({ date, kcal: view.filter((v) => v.date === date).reduce((s, v) => s + v.kcal, 0) })),
      shopping: shoppingList(ingredients),
    };
  }

  private async checkRef(userId: string, kind: PlanKind, refId: string) {
    if (kind === PlanKind.SAVED) {
      const s = await this.prisma.savedMeal.findFirst({ where: { id: refId, userId }, select: { id: true } });
      if (!s) throw new NotFoundException('Esa comida guardada no existe.');
      return;
    }
    const f = await this.prisma.food.findFirst({
      where: { id: refId, archived: false, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { source: true },
    });
    if (!f) throw new NotFoundException('Ese alimento no existe.');
    if (kind === PlanKind.RECIPE && f.source !== FoodSource.RECIPE) throw new BadRequestException('Eso no es una receta.');
  }

  async add(userId: string, dto: { date: string; meal: MealSlot; kind: PlanKind; refId: string; servings?: number }) {
    const date = checkedDate(dto.date);
    await this.checkRef(userId, dto.kind, dto.refId);
    const count = await this.prisma.mealPlanItem.count({ where: { userId, date } });
    if (count >= 40) throw new BadRequestException('Ese día ya tiene demasiadas cosas en el plan.');
    const item = await this.prisma.mealPlanItem.create({
      data: { userId, date, meal: dto.meal, kind: dto.kind, refId: dto.refId, servings: dto.servings ?? 1 },
    });
    return { id: item.id };
  }

  async update(userId: string, id: string, dto: { servings?: number; date?: string; meal?: MealSlot }) {
    const item = await this.prisma.mealPlanItem.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Eso ya no está en el plan.');
    await this.prisma.mealPlanItem.update({
      where: { id },
      data: {
        ...(dto.servings !== undefined ? { servings: dto.servings } : {}),
        ...(dto.date ? { date: checkedDate(dto.date) } : {}),
        ...(dto.meal ? { meal: dto.meal } : {}),
      },
    });
    return { id };
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.mealPlanItem.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException('Eso ya no está en el plan.');
    return { removed: count };
  }

  /** Anotar en el diario lo planeado (en su día y comida). */
  async log(userId: string, id: string) {
    const item = await this.prisma.mealPlanItem.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Eso ya no está en el plan.');
    const date = toDateKey(item.date);
    if (item.kind === PlanKind.SAVED) {
      // Una comida guardada se anota una vez por cada vez planeada.
      const times = Math.max(1, Math.round(item.servings));
      let kcal = 0;
      let entries = 0;
      for (let i = 0; i < times; i++) {
        const r = await this.saved.log(userId, item.refId, { date, meal: item.meal });
        kcal += r.kcal;
        entries += r.entries.length;
      }
      return { date, meal: item.meal, entries, kcal: r0(kcal) };
    }
    const e = await this.diary.add(userId, { date, meal: item.meal, foodId: item.refId, quantity: item.servings });
    return { date, meal: item.meal, entries: 1, kcal: r0(e.kcal) };
  }

  /** Copiar una semana entera a otra (por ejemplo, repetir la de la semana pasada). Suma, no borra. */
  async copyWeek(userId: string, from: string, to: string) {
    const days = daysBetween(from, to);
    if (days === 0 || days % 7 !== 0) throw new BadRequestException('Se copia de una semana a otra (de lunes a lunes).');
    const src = await this.prisma.mealPlanItem.findMany({
      where: { userId, date: { gte: checkedDate(from), lte: checkedDate(shiftKey(from, 6)) } },
    });
    if (!src.length) throw new BadRequestException('Esa semana no tiene nada planeado.');
    await this.prisma.mealPlanItem.createMany({
      data: src.map((s) => ({
        userId,
        date: checkedDate(shiftKey(toDateKey(s.date), days)),
        meal: s.meal,
        kind: s.kind,
        refId: s.refId,
        servings: s.servings,
      })),
    });
    return { copied: src.length };
  }
}
