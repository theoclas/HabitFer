import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { FoodSource, MealSlot, Prisma } from '@prisma/client';
import { addDays, startOfToday } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { CHAINS } from './data/chains';
import { amountText } from './entry.utils';
import { ownPortions } from './food-portions';
import type { CreateFoodDto } from './nutrition.dto';
import { computeSeals, type Seal } from './packaged/seals';
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
  sugar: true,
  satFat: true,
  sodium: true,
  nutrients: true,
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
  OFF: 'Open Food Facts (base abierta; revisa con el empaque)',
  USER: 'Creado por ti',
  RECIPE: 'Receta tuya',
};

/** Lo extra que se guarda de un empacado (por 100 g). */
type PackagedExtra = { transFat?: number | null; sweetener?: boolean; check?: boolean; estimated?: boolean };

const extraOf = (nutrients: Prisma.JsonValue): PackagedExtra =>
  nutrients && typeof nutrients === 'object' && !Array.isArray(nutrients) ? (nutrients as PackagedExtra) : {};

/** Los sellos solo tienen sentido en lo empacado (Open Food Facts o lo que uno crea con la tabla del empaque). */
function sealsOf(f: { source: FoodSource; kcal: number; sugar: number | null; satFat: number | null; sodium: number | null; nutrients: Prisma.JsonValue }): Seal[] {
  if (f.source !== FoodSource.OFF && f.source !== FoodSource.USER) return [];
  const extra = extraOf(f.nutrients);
  return computeSeals({ kcal: f.kcal, sugar: f.sugar, satFat: f.satFat, sodium: f.sodium, transFat: extra.transFat, sweetener: extra.sweetener });
}

/** Lo que se anotó la última vez de un alimento, para repetirlo igual con un toque. */
export type LastAmount = { entryId: string; portionLabel: string | null; quantity: number; grams: number | null; kcal: number; amount: string };

const LAST_SELECT = {
  id: true,
  foodId: true,
  meal: true,
  portionLabel: true,
  quantity: true,
  grams: true,
  prep: true,
  oilGrams: true,
  kcal: true,
  createdAt: true,
} satisfies Prisma.MealEntrySelect;

type LastRow = Prisma.MealEntryGetPayload<{ select: typeof LAST_SELECT }>;

const lastOf = (e: LastRow): LastAmount => ({
  entryId: e.id,
  portionLabel: e.portionLabel,
  quantity: e.quantity,
  grams: e.grams,
  // Lo de la última vez, con sus calorías reales (en un plato, sin las partes que se quitaron; con el aceite).
  kcal: Math.round(e.kcal),
  amount: amountText(e),
});

/** Nutrientes extra que se muestran en el detalle, con su unidad. */
const EXTRA_NUTRIENTS: { key: string; label: string; unit: string }[] = [
  { key: 'calcium', label: 'Calcio', unit: 'mg' },
  { key: 'iron', label: 'Hierro', unit: 'mg' },
  { key: 'potassium', label: 'Potasio', unit: 'mg' },
  { key: 'zinc', label: 'Zinc', unit: 'mg' },
  { key: 'vitA', label: 'Vitamina A', unit: 'µg' },
  { key: 'vitC', label: 'Vitamina C', unit: 'mg' },
  { key: 'cholesterol', label: 'Colesterol', unit: 'mg' },
  { key: 'transFat', label: 'Grasas trans', unit: 'g' },
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
  /** Sellos de advertencia de un empacado (vacío en lo demás). */
  seals: Seal[];
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
    seals: sealsOf(row),
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

  /** Que la próxima búsqueda revise la base compartida ya (se acaba de guardar un empacado). */
  invalidate() {
    this.checkedAt = 0;
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
    const [ranked] = await this.searchMany(userId, [q], 25);
    return ranked;
  }

  /** Cadenas colombianas: dónde ver sus calorías (si las publican) y los platos propios de cada una. */
  async chains(userId: string) {
    const own = await this.prisma.food.findMany({
      where: { ownerId: userId, archived: false, brand: { in: CHAINS.map((c) => c.name) } },
      select: { ...SUMMARY_SELECT, brand: true },
      orderBy: { name: 'asc' },
    });
    return CHAINS.map((c) => ({ ...c, foods: own.filter((f) => f.brand === c.name).map((f) => toResult(f)) }));
  }

  /** Varias búsquedas de una vez (para «escribe o dicta»): los alimentos propios y el uso se leen una sola vez. */
  async searchMany(userId: string, queries: string[], limit = 25): Promise<FoodResult[][]> {
    await this.refresh();
    const [own, uses] = await Promise.all([
      this.prisma.food.findMany({ where: { ownerId: userId, archived: false }, select: SUMMARY_SELECT }),
      this.usage(userId),
    ]);
    const items = [...own.map(toIndexed), ...this.shared].map((it) => ({ ...it, uses: uses.get(it.id) ?? 0 }));
    return queries.map((q) => rank(items, q, limit).map((it) => toResult(it.row)));
  }

  /**
   * Lo que más anotas, primero lo de esta comida (que es como decir «a esta hora del día»), con la
   * última cantidad para repetirla con un toque.
   */
  async recent(userId: string, meal?: MealSlot) {
    const entries = await this.prisma.mealEntry.findMany({
      where: { userId, foodId: { not: null }, quick: false, date: { gte: addDays(startOfToday(), -45) } },
      orderBy: { createdAt: 'desc' },
      take: 400,
      select: LAST_SELECT,
    });
    type Info = { count: number; sameMeal: number; last: LastRow; lastSameMeal: LastRow | null };
    const byFood = new Map<string, Info>();
    for (const e of entries) {
      const key = e.foodId as string;
      const same = e.meal === meal;
      const info = byFood.get(key);
      if (info) {
        info.count++;
        if (same) {
          info.sameMeal++;
          info.lastSameMeal ??= e;
        }
      } else byFood.set(key, { count: 1, sameMeal: same ? 1 : 0, last: e, lastSameMeal: same ? e : null });
    }
    const top = [...byFood.entries()]
      .sort((a, b) => b[1].sameMeal - a[1].sameMeal || b[1].count - a[1].count || b[1].last.createdAt.getTime() - a[1].last.createdAt.getTime())
      .slice(0, 12);
    if (top.length === 0) return [];
    const [rows, favs] = await Promise.all([
      this.prisma.food.findMany({
        where: { id: { in: top.map(([id]) => id) }, archived: false, OR: [{ ownerId: null }, { ownerId: userId }] },
        select: SUMMARY_SELECT,
      }),
      this.favoriteIds(userId),
    ]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    return top
      .filter(([id]) => byId.has(id))
      .map(([id, info]) => ({
        ...toResult(byId.get(id) as SummaryRow),
        timesUsed: info.count,
        favorite: favs.has(id),
        // En esta comida se repite lo de esta comida (el tinto del desayuno no es el de la tarde).
        last: lastOf(info.lastSameMeal ?? info.last),
      }));
  }

  private async favoriteIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.foodFavorite.findMany({ where: { userId }, select: { foodId: true } });
    return new Set(rows.map((r) => r.foodId));
  }

  /** Favoritos (los más recientes primero), con lo que se anotó la última vez si ya se anotaron. */
  async favorites(userId: string) {
    const favs = await this.prisma.foodFavorite.findMany({
      where: { userId, food: { archived: false, OR: [{ ownerId: null }, { ownerId: userId }] } },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { food: { select: SUMMARY_SELECT } },
    });
    if (favs.length === 0) return [];
    const ids = favs.map((f) => f.food.id);
    const lasts = await this.prisma.mealEntry.findMany({
      where: { userId, foodId: { in: ids }, quick: false },
      orderBy: { createdAt: 'desc' },
      distinct: ['foodId'],
      select: LAST_SELECT,
    });
    const lastBy = new Map(lasts.map((e) => [e.foodId as string, e]));
    return favs.map(({ food }) => {
      const last = lastBy.get(food.id);
      return { ...toResult(food), favorite: true, last: last ? lastOf(last) : null };
    });
  }

  /**
   * Lo que sale al abrir una comida: favoritos y lo que más anotas ahí (sin repetir: un favorito
   * que también es reciente se queda arriba, con la cantidad que se usa en esta comida).
   */
  async shortcuts(userId: string, meal?: MealSlot) {
    const [favorites, recents] = await Promise.all([this.favorites(userId), this.recent(userId, meal)]);
    const recentById = new Map(recents.map((r) => [r.id, r]));
    const favIds = new Set(favorites.map((f) => f.id));
    return {
      favorites: favorites.map((f) => ({ ...f, last: recentById.get(f.id)?.last ?? f.last })),
      recents: recents.filter((r) => !favIds.has(r.id)),
    };
  }

  async setFavorite(userId: string, foodId: string, on: boolean) {
    const food = await this.prisma.food.findFirst({ where: { id: foodId, OR: [{ ownerId: null }, { ownerId: userId }] }, select: { id: true } });
    if (!food) throw new NotFoundException('Ese alimento no existe.');
    if (on) {
      await this.prisma.foodFavorite.upsert({ where: { userId_foodId: { userId, foodId } }, create: { userId, foodId }, update: {} });
    } else {
      await this.prisma.foodFavorite.deleteMany({ where: { userId, foodId } });
    }
    return { foodId, favorite: on };
  }

  async detail(userId: string, id: string) {
    const [food, fav, last] = await Promise.all([
      this.prisma.food.findFirst({
        where: { id, OR: [{ ownerId: null }, { ownerId: userId }] },
        include: {
          portions: { orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] },
          parts: {
            orderBy: { sortOrder: 'asc' },
            include: { food: { select: { id: true, name: true, kcal: true, protein: true, fat: true, carbs: true, fiber: true, sugar: true, sodium: true } } },
          },
          _count: { select: { ingredients: true } },
        },
      }),
      this.prisma.foodFavorite.findUnique({ where: { userId_foodId: { userId, foodId: id } }, select: { foodId: true } }),
      // Lo de siempre: la última vez que lo anotó (así el editor arranca con su porción, no con la de la tabla).
      this.prisma.mealEntry.findFirst({
        where: { userId, foodId: id, quick: false },
        orderBy: { createdAt: 'desc' },
        select: { portionLabel: true, quantity: true, grams: true, prep: true, oilGrams: true, parts: true },
      }),
    ]);
    if (!food) throw new NotFoundException('Ese alimento no existe.');
    const extra = food.nutrients && typeof food.nutrients === 'object' && !Array.isArray(food.nutrients) ? (food.nutrients as Record<string, unknown>) : {};
    const servings = food.servings ?? null;
    return {
      id: food.id,
      name: food.name,
      category: food.category,
      brand: food.brand,
      source: food.source,
      sourceLabel:
        food.source === FoodSource.RECIPE && servings
          ? `Receta tuya · ${food._count.ingredients} ingredientes · ${String(Math.round(servings * 10) / 10).replace('.', ',')} porciones`
          : SOURCE_LABELS[food.source],
      own: food.ownerId === userId,
      favorite: fav !== null,
      usual: last,
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
      barcode: food.barcode,
      /** Sellos de advertencia calculados (Resolución 810), y si los datos no cuadran o se estimaron. */
      seals: sealsOf(food),
      check: extraOf(food.nutrients).check === true,
      estimated: extraOf(food.nutrients).estimated === true,
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
    const name = dto.name.trim();
    const brand = dto.brand?.trim() || null;
    const packaged = dto.transFat != null || dto.sweetener !== undefined;
    const row = await this.prisma.food.create({
      data: {
        source: FoodSource.USER,
        name,
        searchText: wordsOf(name, brand).join(' '),
        ownerId: userId,
        brand,
        barcode: dto.barcode ?? null,
        kcal: dto.kcal * f,
        protein: dto.protein * f,
        fat: dto.fat * f,
        carbs: dto.carbs * f,
        fiber: dto.fiber == null ? null : dto.fiber * f,
        sugar: dto.sugar == null ? null : dto.sugar * f,
        satFat: dto.satFat == null ? null : dto.satFat * f,
        sodium: dto.sodium == null ? null : dto.sodium * f,
        ...(packaged
          ? { nutrients: { transFat: dto.transFat == null ? null : dto.transFat * f, sweetener: dto.sweetener === true } as Prisma.InputJsonValue }
          : {}),
        portions: { create: ownPortions(dto).map((p, i) => ({ ...p, sortOrder: i })) },
      },
      select: SUMMARY_SELECT,
    });
    return toResult(row);
  }
}
