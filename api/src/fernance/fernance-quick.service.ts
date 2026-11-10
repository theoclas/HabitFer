import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceCategoryKind,
  FinanceTxType,
  type FinanceShortcut,
} from '@prisma/client';
import { localTodayKey, parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateKeywordDto,
  CreateShortcutDto,
  UpdateShortcutDto,
} from './dto/quick.dto';
import { decimalToNumber, roundPesos } from './fernance.utils';
import { FernanceAccountsService } from './fernance-accounts.service';
import { FernanceCategoriesService } from './fernance-categories.service';
import { suggestShortcuts } from './fernance-quick.utils';
import {
  normalizeKeyword,
  parseMoneyText,
  type ParseContext,
} from './text/money-text.parse';

const MAX_SHORTCUTS = 24;
/** «Lo de siempre» se busca en lo de los últimos 120 días. */
const SUGGEST_DAYS = 120;

function serializeShortcut(s: FinanceShortcut) {
  return {
    id: s.id,
    label: s.label,
    icon: s.icon,
    type: s.type as 'INCOME' | 'EXPENSE',
    amount: decimalToNumber(s.amount),
    accountId: s.accountId,
    categoryId: s.categoryId,
    merchant: s.merchant,
    sortOrder: s.sortOrder,
  };
}

/**
 * Lo que hace rápido anotar: entender lo que se escribe («almuerzo 18 lucas nequi»), las palabras que le enseñaste
 * y «lo de siempre» (guardado por ti o sugerido porque se repite).
 */
@Injectable()
export class FernanceQuickService {
  constructor(
    private prisma: PrismaService,
    private accounts: FernanceAccountsService,
    private categories: FernanceCategoriesService,
  ) {}

  async parseContext(userId: string): Promise<ParseContext> {
    await this.categories.ensureSeeded(userId);
    const [accounts, categories, keywords] = await Promise.all([
      this.prisma.financeAccount.findMany({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, institution: true, kind: true },
      }),
      this.prisma.financeCategory.findMany({
        where: { userId, archivedAt: null },
        select: {
          id: true,
          kind: true,
          systemKey: true,
          parentId: true,
          name: true,
        },
      }),
      this.prisma.financeKeyword.findMany({
        where: { userId },
        select: { keyword: true, categoryId: true, accountId: true },
      }),
    ]);
    return { todayKey: localTodayKey(), accounts, categories, keywords };
  }

  async parse(userId: string, text: string) {
    return parseMoneyText(text, await this.parseContext(userId));
  }

  // ---------- Palabras que le enseñaste ----------

  async keywords(userId: string) {
    const rows = await this.prisma.financeKeyword.findMany({
      where: { userId },
      orderBy: { keyword: 'asc' },
      include: {
        category: { select: { name: true, icon: true } },
        account: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
      categoryIcon: r.category?.icon ?? null,
      accountId: r.accountId,
      accountName: r.account?.name ?? null,
    }));
  }

  /** Enseñar una palabra (o cambiar a dónde lleva una que ya sabía). */
  async addKeyword(userId: string, dto: CreateKeywordDto) {
    const keyword = normalizeKeyword(dto.keyword);
    if (!keyword) throw new BadRequestException('Escribe la palabra.');
    if (!!dto.categoryId === !!dto.accountId)
      throw new BadRequestException(
        'Elige una categoría o una cuenta para esa palabra.',
      );
    if (dto.categoryId) {
      const cat = await this.categories.assertCategory(userId, dto.categoryId);
      if (cat.archivedAt)
        throw new BadRequestException(
          `La categoría «${cat.name}» está archivada.`,
        );
    }
    if (dto.accountId)
      await this.accounts.assertActiveAccount(userId, dto.accountId);
    const data = {
      categoryId: dto.categoryId ?? null,
      accountId: dto.accountId ?? null,
    };
    await this.prisma.financeKeyword.upsert({
      where: { userId_keyword: { userId, keyword } },
      create: { userId, keyword, ...data },
      update: data,
    });
    return (await this.keywords(userId)).find((k) => k.keyword === keyword);
  }

  async removeKeyword(userId: string, id: string) {
    const row = await this.prisma.financeKeyword.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('No encontré esa palabra.');
    await this.prisma.financeKeyword.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- Lo de siempre ----------

  private async checkShortcut(
    userId: string,
    type: 'INCOME' | 'EXPENSE',
    accountId: string | undefined,
    categoryId: string | null | undefined,
  ) {
    if (accountId) await this.accounts.assertActiveAccount(userId, accountId);
    if (categoryId) {
      const cat = await this.categories.assertCategory(userId, categoryId);
      if (cat.archivedAt)
        throw new BadRequestException(
          `La categoría «${cat.name}» está archivada.`,
        );
      const want =
        type === 'INCOME'
          ? FinanceCategoryKind.INCOME
          : FinanceCategoryKind.EXPENSE;
      if (cat.kind !== want)
        throw new BadRequestException(
          'La categoría no es del mismo tipo (gasto o ingreso).',
        );
    }
  }

  async shortcuts(userId: string) {
    const rows = await this.prisma.financeShortcut.findMany({
      where: { userId, account: { archivedAt: null } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(serializeShortcut);
  }

  async addShortcut(userId: string, dto: CreateShortcutDto) {
    const type = dto.type ?? 'EXPENSE';
    const count = await this.prisma.financeShortcut.count({
      where: { userId },
    });
    if (count >= MAX_SHORTCUTS)
      throw new BadRequestException(
        `Ya tienes ${MAX_SHORTCUTS} de «lo de siempre»: borra uno para agregar otro.`,
      );
    await this.checkShortcut(userId, type, dto.accountId, dto.categoryId);
    const row = await this.prisma.financeShortcut.create({
      data: {
        userId,
        label: dto.label.trim(),
        icon: dto.icon?.trim() || null,
        type,
        amount: roundPesos(dto.amount),
        accountId: dto.accountId,
        categoryId: dto.categoryId ?? null,
        merchant: dto.merchant?.trim() || null,
        sortOrder: count,
      },
    });
    return serializeShortcut(row);
  }

  async updateShortcut(userId: string, id: string, dto: UpdateShortcutDto) {
    const row = await this.prisma.financeShortcut.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('No encontré ese «lo de siempre».');
    await this.checkShortcut(
      userId,
      row.type as 'INCOME' | 'EXPENSE',
      dto.accountId,
      dto.categoryId,
    );
    const updated = await this.prisma.financeShortcut.update({
      where: { id },
      data: {
        label: dto.label?.trim(),
        icon: dto.icon !== undefined ? dto.icon.trim() || null : undefined,
        amount: dto.amount !== undefined ? roundPesos(dto.amount) : undefined,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        merchant:
          dto.merchant !== undefined ? dto.merchant.trim() || null : undefined,
      },
    });
    return serializeShortcut(updated);
  }

  async removeShortcut(userId: string, id: string) {
    const row = await this.prisma.financeShortcut.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('No encontré ese «lo de siempre».');
    await this.prisma.financeShortcut.delete({ where: { id } });
    return { ok: true };
  }

  /** «Lo de siempre»: lo que guardaste y lo que se repite. */
  async quick(userId: string) {
    const since = new Date(
      parseDateKey(localTodayKey()).getTime() - SUGGEST_DAYS * 86_400_000,
    );
    const [saved, txs] = await Promise.all([
      this.shortcuts(userId),
      this.prisma.financeTransaction.findMany({
        where: {
          userId,
          type: { in: [FinanceTxType.INCOME, FinanceTxType.EXPENSE] },
          date: { gte: since },
          account: { archivedAt: null },
          OR: [{ categoryId: null }, { category: { archivedAt: null } }],
        },
        select: {
          type: true,
          accountId: true,
          categoryId: true,
          amount: true,
          note: true,
          merchant: true,
          date: true,
        },
      }),
    ]);
    const suggestions = suggestShortcuts(
      txs.map((t) => ({
        type: t.type as 'INCOME' | 'EXPENSE',
        accountId: t.accountId,
        categoryId: t.categoryId,
        amount: decimalToNumber(t.amount),
        note: t.note,
        merchant: t.merchant,
        dateKey: toDateKey(t.date),
      })),
      saved,
    );
    return { shortcuts: saved, suggestions };
  }
}
