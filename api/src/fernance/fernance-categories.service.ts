import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceCategoryKind, type FinanceCategory } from '@prisma/client';
import { localTodayKey, parseDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import {
  SYSTEM_CATEGORIES,
  SYSTEM_CATEGORY_COUNT,
} from './text/money-text.data';
import { normalizeKeyword } from './text/money-text.parse';

/** Para ordenar por uso: lo de los últimos 90 días. */
const USAGE_DAYS = 90;

export function serializeCategory(c: FinanceCategory, uses = 0) {
  return {
    id: c.id,
    kind: c.kind,
    parentId: c.parentId,
    name: c.name,
    icon: c.icon,
    color: c.color,
    systemKey: c.systemKey,
    sortOrder: c.sortOrder,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    /** Cuántas veces se usó en los últimos 90 días. */
    uses,
  };
}

/**
 * Categorías de FerFinance. La primera vez se siembran las colombianas (mercado, domicilios, transporte, servicios,
 * 4x1000…), con subcategorías e íconos. Borrar una la archiva: deja de salir para elegir, pero los movimientos
 * viejos la conservan.
 */
@Injectable()
export class FernanceCategoriesService {
  /** Personas a las que ya se les revisaron las categorías desde que arrancó la API. */
  private readonly seeded = new Set<string>();

  constructor(private prisma: PrismaService) {}

  /** Siembra las categorías que trae FerFinance (y las que se agreguen en versiones nuevas). No duplica. */
  async ensureSeeded(userId: string): Promise<void> {
    if (this.seeded.has(userId)) return;
    const count = await this.prisma.financeCategory.count({
      where: { userId, systemKey: { not: null } },
    });
    if (count < SYSTEM_CATEGORY_COUNT) {
      await this.prisma.financeCategory.createMany({
        data: SYSTEM_CATEGORIES.map((c, i) => ({
          userId,
          kind: c.kind,
          name: c.name,
          icon: c.icon,
          systemKey: c.key,
          sortOrder: i,
        })),
        skipDuplicates: true,
      });
      const parents = await this.prisma.financeCategory.findMany({
        where: {
          userId,
          systemKey: { in: SYSTEM_CATEGORIES.map((c) => c.key) },
        },
        select: { id: true, systemKey: true },
      });
      const parentId = new Map(parents.map((p) => [p.systemKey, p.id]));
      const children = SYSTEM_CATEGORIES.flatMap((c) =>
        (c.children ?? []).map((k, j) => ({
          userId,
          kind: c.kind,
          name: k.name,
          icon: k.icon,
          systemKey: k.key,
          sortOrder: j,
          parentId: parentId.get(c.key) ?? null,
        })),
      ).filter((c) => c.parentId !== null);
      if (children.length)
        await this.prisma.financeCategory.createMany({
          data: children,
          skipDuplicates: true,
        });
    }
    this.seeded.add(userId);
  }

  /** La categoría, si es tuya. */
  async assertCategory(userId: string, id: string): Promise<FinanceCategory> {
    const cat = await this.prisma.financeCategory.findFirst({
      where: { id, userId },
    });
    if (!cat) throw new NotFoundException('No encontré esa categoría.');
    return cat;
  }

  async list(userId: string, includeArchived = false) {
    await this.ensureSeeded(userId);
    const since = new Date(
      parseDateKey(localTodayKey()).getTime() - USAGE_DAYS * 86_400_000,
    );
    const [rows, usage] = await Promise.all([
      this.prisma.financeCategory.findMany({
        where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
        orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.financeTransaction.groupBy({
        by: ['categoryId'],
        where: { userId, categoryId: { not: null }, date: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    const uses = new Map(usage.map((u) => [u.categoryId, u._count._all]));
    return rows.map((r) => serializeCategory(r, uses.get(r.id) ?? 0));
  }

  private async assertUniqueName(
    userId: string,
    kind: FinanceCategoryKind,
    parentId: string | null,
    name: string,
    exceptId?: string,
  ) {
    const siblings = await this.prisma.financeCategory.findMany({
      where: {
        userId,
        kind,
        parentId,
        archivedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { name: true },
    });
    const key = normalizeKeyword(name);
    if (siblings.some((s) => normalizeKeyword(s.name) === key))
      throw new BadRequestException(`Ya tienes una categoría «${name}» ahí.`);
  }

  /** Una principal, tuya, activa y del mismo tipo (las subcategorías no tienen hijas). */
  private async assertParent(
    userId: string,
    parentId: string,
    kind?: FinanceCategoryKind,
  ) {
    const parent = await this.assertCategory(userId, parentId);
    if (parent.parentId)
      throw new BadRequestException(
        'Una subcategoría no puede tener subcategorías.',
      );
    if (parent.archivedAt)
      throw new BadRequestException(
        `«${parent.name}» está archivada: restáurala primero.`,
      );
    if (kind && parent.kind !== kind)
      throw new BadRequestException(
        'La subcategoría debe ser del mismo tipo que la principal.',
      );
    return parent;
  }

  async create(userId: string, dto: CreateCategoryDto) {
    await this.ensureSeeded(userId);
    const parent = dto.parentId
      ? await this.assertParent(userId, dto.parentId, dto.kind)
      : null;
    const kind = parent?.kind ?? dto.kind ?? FinanceCategoryKind.EXPENSE;
    const name = dto.name.trim();
    await this.assertUniqueName(userId, kind, parent?.id ?? null, name);
    const last = await this.prisma.financeCategory.aggregate({
      where: { userId, kind, parentId: parent?.id ?? null },
      _max: { sortOrder: true },
    });
    const row = await this.prisma.financeCategory.create({
      data: {
        userId,
        kind,
        parentId: parent?.id ?? null,
        name,
        icon: dto.icon?.trim() || parent?.icon || null,
        color: dto.color ?? null,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
    return serializeCategory(row);
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    const cat = await this.assertCategory(userId, id);
    let parentId = cat.parentId;
    if (dto.parentId !== undefined) {
      if (dto.parentId === null) parentId = null;
      else {
        if (dto.parentId === id)
          throw new BadRequestException(
            'Una categoría no puede ir dentro de sí misma.',
          );
        const hasChildren = await this.prisma.financeCategory.count({
          where: { parentId: id },
        });
        if (hasChildren)
          throw new BadRequestException(
            'Esta categoría tiene subcategorías: no puede ir dentro de otra.',
          );
        parentId = (await this.assertParent(userId, dto.parentId, cat.kind)).id;
      }
    }
    const name = dto.name?.trim() ?? cat.name;
    if (name !== cat.name || parentId !== cat.parentId)
      await this.assertUniqueName(userId, cat.kind, parentId, name, id);
    const row = await this.prisma.financeCategory.update({
      where: { id },
      data: {
        name,
        parentId,
        icon: dto.icon !== undefined ? dto.icon.trim() || null : undefined,
        color: dto.color !== undefined ? dto.color : undefined,
      },
    });
    return serializeCategory(row);
  }

  /** Archivar (con sus subcategorías): deja de salir para elegir; los movimientos la conservan. */
  async archive(userId: string, id: string) {
    await this.assertCategory(userId, id);
    const now = new Date();
    await this.prisma.financeCategory.updateMany({
      where: { userId, OR: [{ id }, { parentId: id }], archivedAt: null },
      data: { archivedAt: now },
    });
    return serializeCategory(await this.assertCategory(userId, id));
  }

  async restore(userId: string, id: string) {
    const cat = await this.assertCategory(userId, id);
    if (cat.parentId) {
      const parent = await this.assertCategory(userId, cat.parentId);
      if (parent.archivedAt)
        throw new BadRequestException(`Primero restaura «${parent.name}».`);
    }
    await this.prisma.financeCategory.updateMany({
      where: { userId, OR: [{ id }, { parentId: id }] },
      data: { archivedAt: null },
    });
    return serializeCategory(await this.assertCategory(userId, id));
  }
}
