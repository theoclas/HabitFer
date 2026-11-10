import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FoodsService } from '../foods.service';
import { barcodeVariants, isBarcode, offToFood, type PackagedFood } from './off.map';
import { OpenFoodFactsClient } from './open-food-facts.client';
import { savePackaged } from './save-packaged';

export type BarcodeResult =
  | { status: 'found'; foodId: string; from: 'base' | 'off'; check: boolean }
  /** Open Food Facts lo conoce pero no trae tabla nutricional: se crea con la del empaque. */
  | { status: 'no-table'; code: string; name: string | null; brand: string | null }
  | { status: 'unknown'; code: string };

/**
 * Código de barras → alimento. Primero en la base (los propios primero); si no, en Open Food Facts,
 * y lo que se encuentre se guarda para que la segunda vez sea instantáneo y sirva sin conexión a ellos.
 */
@Injectable()
export class BarcodeService {
  constructor(
    private prisma: PrismaService,
    private foods: FoodsService,
    private off: OpenFoodFactsClient,
  ) {}

  private async local(userId: string, codes: string[]) {
    const rows = await this.prisma.food.findMany({
      where: { barcode: { in: codes }, archived: false, OR: [{ ownerId: userId }, { ownerId: null }] },
      select: { id: true, ownerId: true, nutrients: true },
    });
    return rows.find((r) => r.ownerId === userId) ?? rows[0] ?? null;
  }

  async lookup(userId: string, raw: string): Promise<BarcodeResult> {
    const code = raw.trim();
    if (!isBarcode(code)) throw new BadRequestException('Ese código no parece un código de barras (son de 8 a 14 números).');
    const codes = barcodeVariants(code);
    const known = await this.local(userId, codes);
    if (known) return { status: 'found', foodId: known.id, from: 'base', check: checkOf(known.nutrients) };

    let product = await this.off.product(code);
    if (!product && codes.length > 1) product = await this.off.product(codes[1]);
    if (!product) return { status: 'unknown', code };
    const food = offToFood(product, code);
    if (!food) {
      const name = (product.product_name_es || product.product_name || '').trim() || null;
      const brand = (Array.isArray(product.brands) ? product.brands[0] : product.brands?.split(',')[0])?.trim() || null;
      return { status: 'no-table', code, name, brand };
    }
    const saved = await this.save(food);
    return { status: 'found', foodId: saved, from: 'off', check: food.check };
  }

  /** Lo guarda en la base compartida (o lo actualiza si ya estaba) con sus medidas. */
  async save(f: PackagedFood): Promise<string> {
    const id = await savePackaged(this.prisma, f);
    // Que aparezca ya en la búsqueda (la base compartida vive en memoria).
    this.foods.invalidate();
    return id;
  }

  /** Productos colombianos de Open Food Facts por nombre o marca (los que ya están guardados traen su id). */
  async search(userId: string, q: string) {
    const hits = await this.off.search(q);
    const found = hits
      .map((p) => (p.code && /^\d{8,14}$/.test(p.code) ? { code: p.code, food: offToFood(p, p.code) } : null))
      .filter((x): x is { code: string; food: PackagedFood } => x !== null && x.food !== null);
    const codes = found.map((x) => x.code);
    const saved = codes.length
      ? await this.prisma.food.findMany({ where: { barcode: { in: codes }, archived: false, OR: [{ ownerId: null }, { ownerId: userId }] }, select: { id: true, barcode: true } })
      : [];
    const idBy = new Map(saved.map((s) => [s.barcode as string, s.id]));
    return found.map(({ code, food }) => {
      const portion = food.portions.find((p) => p.isDefault) ?? null;
      return {
        code,
        name: food.name,
        brand: food.brand,
        kcal100: Math.round(food.per100.kcal),
        portion: portion ? { label: portion.label, grams: portion.grams } : null,
        kcalPortion: portion ? Math.round((food.per100.kcal * portion.grams) / 100) : null,
        liquid: food.liquid,
        check: food.check,
        foodId: idBy.get(code) ?? null,
      };
    });
  }
}

function checkOf(nutrients: Prisma.JsonValue): boolean {
  return !!nutrients && typeof nutrients === 'object' && !Array.isArray(nutrients) && (nutrients as Record<string, unknown>).check === true;
}
