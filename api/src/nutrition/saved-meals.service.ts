import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type MealSlot } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiaryService } from './diary.service';
import { checkedDate } from './entry.shared';
import { amountText } from './entry.utils';
import type { SavedMealCreateDto, SavedMealLogDto, SavedMealUpdateDto } from './nutrition.dto';

const WITH_ITEMS = { items: { orderBy: { sortOrder: 'asc' } } } satisfies Prisma.SavedMealInclude;
type SavedRow = Prisma.SavedMealGetPayload<{ include: typeof WITH_ITEMS }>;

const r1 = (n: number) => Math.round(n * 10) / 10;

function view(m: SavedRow) {
  const sum = (k: 'kcal' | 'protein' | 'fat' | 'carbs') => m.items.reduce((s, i) => s + i[k], 0);
  return {
    id: m.id,
    name: m.name,
    meal: m.meal,
    lastUsedAt: m.lastUsedAt?.toISOString() ?? null,
    kcal: Math.round(sum('kcal')),
    protein: r1(sum('protein')),
    fat: r1(sum('fat')),
    carbs: r1(sum('carbs')),
    items: m.items.map((i) => ({ id: i.id, name: i.name, amount: amountText(i), kcal: Math.round(i.kcal), quick: i.quick })),
  };
}

/** Comidas guardadas: combinaciones de siempre («Mi desayuno de semana») que se anotan de un toque. */
@Injectable()
export class SavedMealsService {
  constructor(
    private prisma: PrismaService,
    private diary: DiaryService,
  ) {}

  private async find(userId: string, id: string): Promise<SavedRow> {
    const m = await this.prisma.savedMeal.findFirst({ where: { id, userId }, include: WITH_ITEMS });
    if (!m) throw new NotFoundException('Esa comida guardada no existe.');
    return m;
  }

  /** Las que se usaron hace poco primero; con `meal`, primero las que se guardaron en esa comida. */
  async list(userId: string, meal?: MealSlot) {
    const rows = await this.prisma.savedMeal.findMany({
      where: { userId },
      include: WITH_ITEMS,
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      take: 60,
    });
    const list = rows.map(view);
    if (meal) list.sort((a, b) => Number(b.meal === meal) - Number(a.meal === meal));
    return list;
  }

  /** Guarda lo que hay anotado en una comida de un día. */
  async create(userId: string, dto: SavedMealCreateDto) {
    const date = checkedDate(dto.date);
    const entries = await this.prisma.mealEntry.findMany({
      where: { userId, date, meal: dto.meal },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (entries.length === 0) throw new BadRequestException('Esa comida está vacía: anota algo primero.');
    if (entries.length > 60) throw new BadRequestException('Son demasiadas cosas para una comida guardada.');
    const created = await this.prisma.savedMeal.create({
      data: {
        userId,
        name: dto.name.trim(),
        meal: dto.meal,
        items: {
          create: entries.map((e, i) => ({
            foodId: e.foodId,
            quick: e.quick,
            name: e.name,
            portionLabel: e.portionLabel,
            portionGrams: e.portionGrams,
            quantity: e.quantity,
            grams: e.grams,
            kcal: e.kcal,
            protein: e.protein,
            fat: e.fat,
            carbs: e.carbs,
            fiber: e.fiber,
            sugar: e.sugar,
            sodium: e.sodium,
            parts: e.parts === null ? Prisma.DbNull : (e.parts as Prisma.InputJsonValue),
            prep: e.prep,
            oilGrams: e.oilGrams,
            sortOrder: i,
          })),
        },
      },
      include: WITH_ITEMS,
    });
    return view(created);
  }

  /** Cambiar el nombre o quitar cosas (`itemIds` = lo que se queda). */
  async update(userId: string, id: string, dto: SavedMealUpdateDto) {
    const m = await this.find(userId, id);
    const keep = dto.itemIds ? new Set(dto.itemIds) : null;
    if (keep && !m.items.some((i) => keep.has(i.id))) throw new BadRequestException('Deja al menos una cosa en la comida guardada.');
    await this.prisma.$transaction([
      ...(dto.name !== undefined ? [this.prisma.savedMeal.update({ where: { id: m.id }, data: { name: dto.name.trim() } })] : []),
      ...(keep ? [this.prisma.savedMealItem.deleteMany({ where: { savedMealId: m.id, id: { notIn: [...keep] } } })] : []),
    ]);
    return view(await this.find(userId, id));
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.savedMeal.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Esa comida guardada no existe.');
    return { ok: true };
  }

  /** Anotarla completa (o solo lo elegido) en un día y una comida. */
  async log(userId: string, id: string, dto: SavedMealLogDto) {
    const m = await this.find(userId, id);
    const date = checkedDate(dto.date);
    const wanted = dto.itemIds ? new Set(dto.itemIds) : null;
    const items = wanted ? m.items.filter((i) => wanted.has(i.id)) : m.items;
    if (items.length === 0) throw new BadRequestException('Elige al menos una cosa.');
    const entries = await this.diary.cloneInto(
      userId,
      items.map((template) => ({ template, date, meal: dto.meal })),
    );
    await this.prisma.savedMeal.update({ where: { id: m.id }, data: { lastUsedAt: new Date() } });
    return { entries, kcal: Math.round(entries.reduce((s, e) => s + e.kcal, 0)) };
  }
}
