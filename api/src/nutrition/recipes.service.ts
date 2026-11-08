import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FoodSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeOr400, FOOD_FOR_ENTRY } from './entry.shared';
import { amountText } from './entry.utils';
import type { RecipeDto } from './nutrition.dto';
import { recipeValues, roundTotals } from './nutrition-math';
import { wordsOf } from './search.utils';

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Recetas propias: los ingredientes de la olla entera y cuántas porciones salen. Cada receta es un
 * alimento más (fuente RECIPE) con su porción, así que se busca y se anota como cualquier otro.
 */
@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.food.findMany({
      where: { ownerId: userId, source: FoodSource.RECIPE, archived: false },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        kcal: true,
        protein: true,
        servings: true,
        portions: { where: { isDefault: true }, take: 1, select: { grams: true } },
        _count: { select: { ingredients: true } },
      },
    });
    return rows.map((r) => {
      const serving = r.portions[0]?.grams ?? 0;
      return {
        id: r.id,
        name: r.name,
        servings: r.servings ?? 1,
        ingredients: r._count.ingredients,
        servingGrams: Math.round(serving),
        kcalServing: Math.round((r.kcal * serving) / 100),
        proteinServing: r1((r.protein * serving) / 100),
      };
    });
  }

  async get(userId: string, id: string) {
    const food = await this.prisma.food.findFirst({
      where: { id, ownerId: userId, source: FoodSource.RECIPE, archived: false },
      include: {
        ingredients: { orderBy: { sortOrder: 'asc' }, include: { food: true } },
        portions: { where: { isDefault: true }, take: 1 },
      },
    });
    if (!food) throw new NotFoundException('Esa receta no existe.');
    return {
      id: food.id,
      name: food.name,
      servings: food.servings ?? 1,
      cookedGrams: food.cookedGrams,
      servingGrams: r1(food.portions[0]?.grams ?? 0),
      ingredients: food.ingredients.map((ing) => ({
        id: ing.id,
        foodId: ing.foodId,
        name: ing.food.name,
        portionLabel: ing.portionLabel,
        quantity: ing.quantity,
        grams: ing.grams,
        amount: amountText(ing),
        per100: {
          kcal: ing.food.kcal,
          protein: ing.food.protein,
          fat: ing.food.fat,
          carbs: ing.food.carbs,
          fiber: ing.food.fiber,
          sugar: ing.food.sugar,
          sodium: ing.food.sodium,
        },
      })),
    };
  }

  /** Crea (sin `id`) o reemplaza una receta: recalcula sus valores por 100 g y sus porciones. */
  async save(userId: string, dto: RecipeDto, id?: string) {
    if (id) {
      const existing = await this.prisma.food.findFirst({ where: { id, ownerId: userId, source: FoodSource.RECIPE, archived: false }, select: { id: true } });
      if (!existing) throw new NotFoundException('Esa receta no existe.');
    }
    const foodIds = [...new Set(dto.ingredients.map((i) => i.foodId))];
    if (id && foodIds.includes(id)) throw new BadRequestException('Una receta no puede llevarse a sí misma.');
    const foods = await this.prisma.food.findMany({
      where: { id: { in: foodIds }, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: FOOD_FOR_ENTRY,
    });
    const byId = new Map(foods.map((f) => [f.id, f]));
    const items = dto.ingredients.map((ing) => {
      const food = byId.get(ing.foodId);
      if (!food) throw new NotFoundException('Uno de los ingredientes ya no existe.');
      const v = computeOr400(food, { portionId: ing.portionId, portionLabel: ing.portionLabel, grams: ing.grams, quantity: ing.quantity });
      return { food, v };
    });
    const r = recipeValues(
      items.map(({ v }) => ({ grams: v.grams, totals: v.totals })),
      dto.servings,
      dto.cookedGrams,
    );
    if (r.weight <= 0) throw new BadRequestException('Los ingredientes no pesan nada: revisa las cantidades.');

    const name = dto.name.trim();
    const per100 = roundTotals(r.per100);
    const values = {
      name,
      searchText: wordsOf(name).join(' '),
      category: 'Recetas',
      kcal: r.per100.kcal,
      protein: r.per100.protein,
      fat: r.per100.fat,
      carbs: r.per100.carbs,
      fiber: per100.fiber,
      sugar: per100.sugar,
      sodium: per100.sodium,
      servings: dto.servings,
      cookedGrams: dto.cookedGrams ?? null,
    };
    const portions = [
      { label: 'Porción', grams: r1(r.servingGrams), isDefault: true, sortOrder: 0 },
      ...(dto.servings !== 1 ? [{ label: 'Toda la receta', grams: r1(r.weight), isDefault: false, sortOrder: 1 }] : []),
    ];
    const ingredients = items.map(({ food, v }, i) => ({
      foodId: food.id,
      portionLabel: v.portionLabel,
      quantity: v.quantity,
      grams: v.grams,
      sortOrder: i,
    }));

    const saved = id
      ? await this.prisma.$transaction(async (tx) => {
          await tx.foodPortion.deleteMany({ where: { foodId: id } });
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          return tx.food.update({
            where: { id },
            data: { ...values, portions: { create: portions }, ingredients: { create: ingredients } },
            select: { id: true },
          });
        })
      : await this.prisma.food.create({
          data: { source: FoodSource.RECIPE, ownerId: userId, ...values, portions: { create: portions }, ingredients: { create: ingredients } },
          select: { id: true },
        });
    return this.get(userId, saved.id);
  }

  /** Se archiva (no se borra): lo que ya se anotó con ella se queda igual. */
  async remove(userId: string, id: string) {
    const { count } = await this.prisma.food.updateMany({
      where: { id, ownerId: userId, source: FoodSource.RECIPE, archived: false },
      data: { archived: true },
    });
    if (count === 0) throw new NotFoundException('Esa receta no existe.');
    return { ok: true };
  }
}
