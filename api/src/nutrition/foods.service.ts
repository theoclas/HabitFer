import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { FoodSource, MealSlot, Prisma } from '@prisma/client';
import { addDays, startOfToday } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFoodDto } from './nutrition.dto';
import { normalize, rank, withoutWords, wordsOf, type SearchItem } from './search.utils';

const SUMMARY_SELECT = {
  id: true,
  name: true,
  searchText: true,
  category: true,
  source: true,
  kcal: true,
  protein: true,
  fat: true,
  carbs: true,
  priority: true,
  portions: { where: { isDefault: true }, take: 1, select: { id: true, label: true, grams: true } },
  _count: { select: { parts: true } },
} satisfies Prisma.FoodSelect;

type SummaryRow = Prisma.FoodGetPayload<{ select: typeof SUMMARY_SELECT }>;
type Indexed = SearchItem & { row: SummaryRow };

export const SOURCE_LABELS: Record<FoodSource, string> = {
  TCAC: 'Tabla de Composición de Alimentos Colombianos (ICBF, 2018)',
  P18: 'Preparación tradicional medida por el ICBF y la Universidad Nacional',
  DISH: 'Plato armado por partes con la tabla del ICBF',
  USDA: 'USDA FoodData Central',
  OFF: 'Open Food Facts',
  USER: 'Creado por ti',
};

/** Nutrientes extra que se muestran en el detalle, con su unidad. */
const EXTRA_NUTRIENTS: { key: string; label: string; unit: string }[] = [
  { key: 'calcium', label: 'Calcio', unit: 'mg' },
  { key: 'iron', label: 'Hierro', unit: 'mg' },
  { key: 'potassium', label: 'Potasio', unit: 'mg' },
  { key: 'zinc', label: 'Zinc', unit: 'mg' },
  { key: 'vitA', label: 'Vitamina A', unit: 'µg' },
  { key: 'vitC', label: 'Vitamina C', unit: 'mg' },
  { key: 'cholesterol', label: 'Colesterol', unit: 'mg' },
];

const r1 = (n: number) => Math.round(n * 10) / 10;

export type FoodResult = {
  id: string;
  name: string;
  category: string | null;
  source: FoodSource;
  kcal100: number;
  portion: { id: string; label: string; grams: number } | null;
  kcalPortion: number | null;
  isDish: boolean;
};

function toResult(row: SummaryRow): FoodResult {
  const p = row.portions[0] ?? null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    source: row.source,
    kcal100: Math.round(row.kcal),
    portion: p ? { id: p.id, label: p.label, grams: p.grams } : null,
    kcalPortion: p ? Math.round((row.kcal * p.grams) / 100) : null,
    isDish: row._count.parts > 0,
  };
}

function toIndexed(row: SummaryRow): Indexed {
  const words = row.searchText ? [...new Set(row.searchText.split(' ').filter(Boolean))] : wordsOf(row.name);
  return { id: row.id, name: normalize(row.name), words, without: withoutWords(row.name), source: row.source, priority: row.priority, row };
}

/**
 * Alimentos: la base compartida (ICBF, platos típicos) vive en memoria para buscar al instante;
 * los alimentos propios de cada usuario se leen en cada búsqueda (son pocos).
 */
@Injectable()
export class FoodsService implements OnModuleInit {
  private readonly logger = new Logger(FoodsService.name);
  private shared: Indexed[] = [];
  private signature = '';
  private checkedAt = 0;
  private loading: Promise<void> | null = null;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.refresh(true).catch((err) => this.logger.error(`No se pudo cargar la base de alimentos: ${(err as Error).message}`));
  }

  /** Recarga la base compartida si cambió (se revisa como mucho cada 2 minutos). */
  private refresh(force = false): Promise<void> {
    if (!force && Date.now() - this.checkedAt < 120_000) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [count, last] = await Promise.all([
        this.prisma.food.count({ where: { ownerId: null } }),
        this.prisma.food.findFirst({ where: { ownerId: null }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      ]);
      this.checkedAt = Date.now();
      const sig = `${count}:${last?.updatedAt.toISOString() ?? ''}`;
      if (!force && sig === this.signature) return;
      const rows = await this.prisma.food.findMany({ where: { ownerId: null, archived: false }, select: SUMMARY_SELECT });
      this.shared = rows.map(toIndexed);
      this.signature = sig;
      this.logger.log(`Base de alimentos cargada: ${rows.length}`);
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /** Cuántas veces anotó el usuario cada alimento en los últimos 90 días. */
  private async usage(userId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.mealEntry.groupBy({
      by: ['foodId'],
      where: { userId, foodId: { not: null }, date: { gte: addDays(startOfToday(), -90) } },
      _count: { _all: true },
    });
    return new Map(rows.filter((r) => r.foodId).map((r) => [r.foodId as string, r._count._all]));
  }

  async search(userId: string, q: string): Promise<FoodResult[]> {
    await this.refresh();
    const [own, uses] = await Promise.all([
      this.prisma.food.findMany({ where: { ownerId: userId, archived: false }, select: SUMMARY_SELECT }),
      this.usage(userId),
    ]);
    const items = [...own.map(toIndexed), ...this.shared].map((it) => ({ ...it, uses: uses.get(it.id) ?? 0 }));
    return rank(items, q, 25).map((it) => toResult(it.row));
  }

  /** Lo que más anotas, primero lo de esta comida; con la última cantidad para repetirla con un toque. */
  async recent(userId: string, meal?: MealSlot) {
    const entries = await this.prisma.mealEntry.findMany({
      where: { userId, foodId: { not: null }, date: { gte: addDays(startOfToday(), -45) } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { foodId: true, meal: true, portionLabel: true, quantity: true, grams: true, kcal: true, createdAt: true },
    });
    type Info = { count: number; sameMeal: number; last: (typeof entries)[number] };
    const byFood = new Map<string, Info>();
    for (const e of entries) {
      const key = e.foodId as string;
      const info = byFood.get(key);
      if (info) {
        info.count++;
        if (e.meal === meal) info.sameMeal++;
      } else byFood.set(key, { count: 1, sameMeal: e.meal === meal ? 1 : 0, last: e });
    }
    const top = [...byFood.entries()]
      .sort((a, b) => b[1].sameMeal - a[1].sameMeal || b[1].count - a[1].count || b[1].last.createdAt.getTime() - a[1].last.createdAt.getTime())
      .slice(0, 12);
    if (top.length === 0) return [];
    const rows = await this.prisma.food.findMany({
      where: { id: { in: top.map(([id]) => id) }, archived: false, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: SUMMARY_SELECT,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return top
      .filter(([id]) => byId.has(id))
      .map(([id, info]) => ({
        ...toResult(byId.get(id) as SummaryRow),
        timesUsed: info.count,
        // Lo de la última vez, con sus calorías reales (en un plato, sin las partes que se quitaron).
        last: { portionLabel: info.last.portionLabel, quantity: info.last.quantity, grams: info.last.grams, kcal: Math.round(info.last.kcal) },
      }));
  }

  async detail(userId: string, id: string) {
    const food = await this.prisma.food.findFirst({
      where: { id, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: {
        portions: { orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] },
        parts: {
          orderBy: { sortOrder: 'asc' },
          include: { food: { select: { id: true, name: true, kcal: true, protein: true, fat: true, carbs: true, fiber: true, sugar: true, sodium: true } } },
        },
      },
    });
    if (!food) throw new NotFoundException('Ese alimento no existe.');
    const extra = food.nutrients && typeof food.nutrients === 'object' && !Array.isArray(food.nutrients) ? (food.nutrients as Record<string, unknown>) : {};
    return {
      id: food.id,
      name: food.name,
      category: food.category,
      brand: food.brand,
      source: food.source,
      sourceLabel: SOURCE_LABELS[food.source],
      own: food.ownerId === userId,
      per100: {
        kcal: Math.round(food.kcal),
        protein: r1(food.protein),
        fat: r1(food.fat),
        carbs: r1(food.carbs),
        fiber: food.fiber == null ? null : r1(food.fiber),
        sugar: food.sugar == null ? null : r1(food.sugar),
        satFat: food.satFat == null ? null : r1(food.satFat),
        sodium: food.sodium == null ? null : Math.round(food.sodium),
      },
      extra: EXTRA_NUTRIENTS.filter((n) => typeof extra[n.key] === 'number').map((n) => ({ ...n, value: r1(extra[n.key] as number) })),
      portions: food.portions.map((p) => ({ id: p.id, label: p.label, grams: p.grams, isDefault: p.isDefault })),
      parts: food.parts.map((p) => ({
        id: p.id,
        label: p.label,
        grams: p.grams,
        foodId: p.foodId,
        foodName: p.food.name,
        per100: { kcal: p.food.kcal, protein: p.food.protein, fat: p.food.fat, carbs: p.food.carbs, fiber: p.food.fiber, sugar: p.food.sugar, sodium: p.food.sodium },
      })),
    };
  }

  /** Alimento propio: los valores llegan por porción (o por 100 g) y se guardan por 100 g. */
  async create(userId: string, dto: CreateFoodDto): Promise<FoodResult> {
    const grams = dto.portionGrams ?? 100;
    const f = 100 / grams;
    const label = dto.portionLabel?.trim() || (dto.portionGrams ? 'Porción' : '100 g');
    const name = dto.name.trim();
    const row = await this.prisma.food.create({
      data: {
        source: FoodSource.USER,
        name,
        searchText: wordsOf(name).join(' '),
        ownerId: userId,
        kcal: dto.kcal * f,
        protein: dto.protein * f,
        fat: dto.fat * f,
        carbs: dto.carbs * f,
        fiber: dto.fiber == null ? null : dto.fiber * f,
        sugar: dto.sugar == null ? null : dto.sugar * f,
        sodium: dto.sodium == null ? null : dto.sodium * f,
        portions: { create: [{ label, grams, isDefault: true }] },
      },
      select: SUMMARY_SELECT,
    });
    return toResult(row);
  }
}
