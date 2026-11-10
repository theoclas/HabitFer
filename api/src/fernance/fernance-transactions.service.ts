import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceCategoryKind,
  FinanceTxSource,
  FinanceTxType,
  InstallmentStatus,
  type FinanceTransaction,
  type Prisma,
} from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  BulkTransactionsDto,
  CreateTransactionDto,
  ListMovementsQuery,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { decimalToNumber, paidKeyOf, roundPesos } from './fernance.utils';
import { FernanceAccountsService } from './fernance-accounts.service';
import { FernanceCategoriesService } from './fernance-categories.service';
import { FernanceLedgerService } from './fernance-ledger.service';
import {
  installmentToItem,
  movementTotals,
  sortMovements,
  txToItem,
  type MovementInstallment,
  type MovementTx,
} from './fernance-movements.utils';
import { normalizeKeyword, parseNumeric } from './text/money-text.parse';

/** Lo más que se lee de una vez para sumar (un año largo de movimientos). */
const MAX_ROWS = 5000;
const DEFAULT_LIMIT = 500;

export function toMovementTx(row: FinanceTransaction): MovementTx {
  return {
    id: row.id,
    type: row.type,
    dateKey: toDateKey(row.date),
    amount: decimalToNumber(row.amount),
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    categoryId: row.categoryId,
    merchant: row.merchant,
    note: row.note,
    source: row.source,
    needsReview: row.needsReview,
    createdAt: row.createdAt.toISOString(),
  };
}

/** undefined = no cambiar; vacío = quitar. */
function clean(
  value: string | undefined,
  max: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

const kindFor = (type: FinanceTxType) =>
  type === FinanceTxType.INCOME
    ? FinanceCategoryKind.INCOME
    : FinanceCategoryKind.EXPENSE;

/**
 * Movimientos de FerFinance: ingresos, gastos y transferencias entre tus cuentas (los ajustes salen del cuadre con
 * el banco). La lista junta también las cuotas pagadas de los créditos, porque también sacan plata de una cuenta.
 */
@Injectable()
export class FernanceTransactionsService {
  constructor(
    private prisma: PrismaService,
    private accounts: FernanceAccountsService,
    private categories: FernanceCategoriesService,
    private ledger: FernanceLedgerService,
  ) {}

  private async assertTx(userId: string, id: string) {
    const row = await this.prisma.financeTransaction.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('No encontré ese movimiento.');
    return row;
  }

  /** La categoría para un tipo de movimiento: tuya, activa y del tipo que corresponde. */
  private async checkCategory(
    userId: string,
    categoryId: string | null,
    type: FinanceTxType,
    current: string | null = null,
  ): Promise<string | null> {
    if (categoryId === null) return null;
    if (type === FinanceTxType.TRANSFER || type === FinanceTxType.ADJUSTMENT)
      throw new BadRequestException(
        'Las transferencias y los ajustes no llevan categoría.',
      );
    const cat = await this.categories.assertCategory(userId, categoryId);
    if (cat.archivedAt && cat.id !== current)
      throw new BadRequestException(
        `La categoría «${cat.name}» está archivada.`,
      );
    if (cat.kind !== kindFor(type))
      throw new BadRequestException(
        type === FinanceTxType.INCOME
          ? 'Esa categoría es de gastos; elige una de ingresos.'
          : 'Esa categoría es de ingresos; elige una de gastos.',
      );
    return cat.id;
  }

  /** El movimiento como se muestra, mirado desde todas tus cuentas. */
  async item(userId: string, row: FinanceTransaction) {
    const scope = await this.ledger.scope(userId);
    const lookups = await this.ledger.lookups(userId, scope.accounts);
    return txToItem(
      toMovementTx(row),
      lookups,
      new Set(scope.accounts.map((a) => a.id)),
    );
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const type = dto.type as FinanceTxType;
    const account = await this.accounts.assertActiveAccount(
      userId,
      dto.accountId,
    );
    let toAccountId: string | null = null;
    if (type === FinanceTxType.TRANSFER) {
      if (!dto.toAccountId)
        throw new BadRequestException('Elige a qué cuenta llega la plata.');
      if (dto.toAccountId === dto.accountId)
        throw new BadRequestException(
          'La cuenta de salida y la de llegada deben ser distintas.',
        );
      toAccountId = (
        await this.accounts.assertActiveAccount(userId, dto.toAccountId)
      ).id;
    }
    const categoryId =
      type === FinanceTxType.TRANSFER
        ? null
        : await this.checkCategory(userId, dto.categoryId ?? null, type);
    const row = await this.prisma.financeTransaction.create({
      data: {
        userId,
        type,
        accountId: account.id,
        toAccountId,
        amount: roundPesos(dto.amount),
        date: parseDateKey(dto.date),
        categoryId,
        merchant:
          type === FinanceTxType.TRANSFER
            ? null
            : (clean(dto.merchant, 120) ?? null),
        note: clean(dto.note, 300) ?? null,
        source:
          (dto.source as FinanceTxSource | undefined) ?? FinanceTxSource.MANUAL,
        rawText: clean(dto.rawText, 500) ?? null,
      },
    });
    return this.item(userId, row);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const tx = await this.assertTx(userId, id);

    if (tx.type === FinanceTxType.ADJUSTMENT) {
      if (
        dto.type ||
        dto.accountId ||
        dto.toAccountId !== undefined ||
        dto.categoryId !== undefined ||
        dto.merchant !== undefined
      )
        throw new BadRequestException(
          'Un ajuste solo cambia el monto, la fecha o la nota.',
        );
      if (dto.amount !== undefined && Math.abs(dto.amount) < 1)
        throw new BadRequestException(
          'Un ajuste debe ser de al menos $ 1. Si ya no aplica, bórralo.',
        );
      const row = await this.prisma.financeTransaction.update({
        where: { id },
        data: {
          amount: dto.amount !== undefined ? roundPesos(dto.amount) : undefined,
          date: dto.date ? parseDateKey(dto.date) : undefined,
          note: clean(dto.note, 300),
        },
      });
      return this.item(userId, row);
    }

    const type = (dto.type as FinanceTxType | undefined) ?? tx.type;
    if (dto.amount !== undefined && dto.amount < 1)
      throw new BadRequestException('El monto debe ser de al menos $ 1.');
    let accountId = tx.accountId;
    if (dto.accountId && dto.accountId !== tx.accountId)
      accountId = (
        await this.accounts.assertActiveAccount(userId, dto.accountId)
      ).id;

    let toAccountId: string | null = null;
    if (type === FinanceTxType.TRANSFER) {
      toAccountId =
        dto.toAccountId !== undefined ? dto.toAccountId : tx.toAccountId;
      if (!toAccountId)
        throw new BadRequestException('Elige a qué cuenta llega la plata.');
      if (toAccountId !== tx.toAccountId)
        await this.accounts.assertActiveAccount(userId, toAccountId);
      if (toAccountId === accountId)
        throw new BadRequestException(
          'La cuenta de salida y la de llegada deben ser distintas.',
        );
    }

    let categoryId: string | null = tx.categoryId;
    if (type === FinanceTxType.TRANSFER) categoryId = null;
    else if (dto.categoryId !== undefined)
      categoryId = await this.checkCategory(
        userId,
        dto.categoryId,
        type,
        tx.categoryId,
      );
    else if (tx.categoryId && type !== tx.type) {
      // Pasó de gasto a ingreso (o al revés): la categoría de antes ya no sirve.
      const cat = await this.prisma.financeCategory.findUnique({
        where: { id: tx.categoryId },
      });
      categoryId = cat && cat.kind === kindFor(type) ? cat.id : null;
    }

    const row = await this.prisma.financeTransaction.update({
      where: { id },
      data: {
        type,
        accountId,
        toAccountId,
        categoryId,
        amount: dto.amount !== undefined ? roundPesos(dto.amount) : undefined,
        date: dto.date ? parseDateKey(dto.date) : undefined,
        merchant:
          type === FinanceTxType.TRANSFER ? null : clean(dto.merchant, 120),
        note: clean(dto.note, 300),
      },
    });
    return this.item(userId, row);
  }

  async remove(userId: string, id: string) {
    await this.assertTx(userId, id);
    await this.prisma.financeTransaction.delete({ where: { id } });
    return { ok: true };
  }

  /** Cambiar la categoría, la cuenta o la fecha de varios movimientos (o borrarlos). */
  async bulk(userId: string, dto: BulkTransactionsDto) {
    const rows = await this.prisma.financeTransaction.findMany({
      where: { userId, id: { in: dto.ids } },
    });
    if (!rows.length)
      throw new NotFoundException('No encontré esos movimientos.');
    const missing = dto.ids.length - rows.length;
    if (dto.delete) {
      const r = await this.prisma.financeTransaction.deleteMany({
        where: { userId, id: { in: rows.map((x) => x.id) } },
      });
      return { count: r.count, skipped: missing };
    }
    if (dto.categoryId === undefined && !dto.accountId && !dto.date)
      throw new BadRequestException(
        'Dime qué cambiar: la categoría, la cuenta o la fecha.',
      );
    const account = dto.accountId
      ? await this.accounts.assertActiveAccount(userId, dto.accountId)
      : null;
    const category = dto.categoryId
      ? await this.categories.assertCategory(userId, dto.categoryId)
      : null;
    if (category?.archivedAt)
      throw new BadRequestException(
        `La categoría «${category.name}» está archivada.`,
      );

    const updates: Prisma.PrismaPromise<unknown>[] = [];
    let skipped = missing;
    for (const r of rows) {
      const data: Prisma.FinanceTransactionUncheckedUpdateInput = {};
      if (dto.date) data.date = parseDateKey(dto.date);
      if (
        account &&
        r.accountId !== account.id &&
        !(r.type === FinanceTxType.TRANSFER && r.toAccountId === account.id)
      )
        data.accountId = account.id;
      if (
        dto.categoryId !== undefined &&
        (r.type === FinanceTxType.INCOME || r.type === FinanceTxType.EXPENSE)
      ) {
        if (dto.categoryId === null) data.categoryId = null;
        else if (category && category.kind === kindFor(r.type))
          data.categoryId = category.id;
      }
      if (Object.keys(data).length)
        updates.push(
          this.prisma.financeTransaction.update({ where: { id: r.id }, data }),
        );
      else skipped++;
    }
    if (updates.length) await this.prisma.$transaction(updates);
    return { count: updates.length, skipped };
  }

  /**
   * La lista de movimientos con búsqueda y filtros, y los totales de todo lo filtrado (no solo de lo que se
   * muestra). La búsqueda mira la nota, el comercio, lo que se escribió y la categoría; si es un número, también
   * el monto.
   */
  async movements(userId: string, q: ListMovementsQuery) {
    const scope = await this.ledger.scope(userId, q.accountId, q.book);
    const ids = [...scope.ids];
    const from = q.from;
    const to = q.to;
    if (from && to && from > to)
      throw new BadRequestException('La fecha «desde» va después de «hasta».');

    let categoryIds: string[] | null = null;
    if (q.categoryId) {
      const cats = await this.prisma.financeCategory.findMany({
        where: {
          userId,
          OR: [{ id: q.categoryId }, { parentId: q.categoryId }],
        },
        select: { id: true },
      });
      if (!cats.length)
        throw new NotFoundException('No encontré esa categoría.');
      categoryIds = cats.map((c) => c.id);
    }
    const text = q.q?.trim() || null;
    const numeric = text ? parseNumeric(text.replace(/[$\s]/g, '')) : null;
    const amountMatch = numeric !== null && numeric >= 1 ? numeric : null;

    const txRows =
      q.type === 'INSTALLMENT' || !ids.length
        ? []
        : await this.prisma.financeTransaction.findMany({
            where: {
              userId,
              AND: [
                {
                  OR: [
                    { accountId: { in: ids } },
                    { toAccountId: { in: ids } },
                  ],
                },
                ...(text
                  ? [
                      {
                        OR: [
                          { note: { contains: text } },
                          { merchant: { contains: text } },
                          { rawText: { contains: text } },
                          { category: { name: { contains: text } } },
                          ...(amountMatch !== null
                            ? [{ amount: { equals: amountMatch } }]
                            : []),
                        ],
                      },
                    ]
                  : []),
              ],
              ...(from || to
                ? {
                    date: {
                      ...(from ? { gte: parseDateKey(from) } : {}),
                      ...(to ? { lte: parseDateKey(to) } : {}),
                    },
                  }
                : {}),
              ...(q.type ? { type: q.type } : {}),
              ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
              ...(q.min !== undefined || q.max !== undefined
                ? {
                    amount: {
                      ...(q.min !== undefined ? { gte: q.min } : {}),
                      ...(q.max !== undefined ? { lte: q.max } : {}),
                    },
                  }
                : {}),
            },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            take: MAX_ROWS + 1,
          });

    const installments: MovementInstallment[] = [];
    if ((!q.type || q.type === 'INSTALLMENT') && !categoryIds && ids.length) {
      const credits = await this.prisma.credit.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          accountId: true,
          installments: {
            where: { status: InstallmentStatus.PAID },
            select: {
              id: true,
              amount: true,
              status: true,
              dueDate: true,
              paidAt: true,
              paidDate: true,
              paidAmount: true,
              paidAccountId: true,
            },
          },
        },
      });
      const textKey = text ? normalizeKeyword(text) : null;
      for (const c of credits) {
        for (const i of c.installments) {
          const key = paidKeyOf(i);
          if (!key || (from && key < from) || (to && key > to)) continue;
          const accountId = i.paidAccountId ?? c.accountId;
          if (!scope.ids.has(accountId)) continue;
          const amount = decimalToNumber(i.paidAmount ?? i.amount);
          if (q.min !== undefined && amount < q.min) continue;
          if (q.max !== undefined && amount > q.max) continue;
          if (
            textKey &&
            !normalizeKeyword(`cuota ${c.name}`).includes(textKey) &&
            !(
              amountMatch !== null &&
              Math.round(amount) === Math.round(amountMatch)
            )
          )
            continue;
          installments.push({
            id: i.id,
            creditId: c.id,
            creditName: c.name,
            dateKey: key,
            amount,
            accountId,
          });
        }
      }
    }

    const lookups = await this.ledger.lookups(userId, scope.accounts);
    const items = sortMovements([
      ...txRows
        .slice(0, MAX_ROWS)
        .map((r) => txToItem(toMovementTx(r), lookups, scope.ids)),
      ...installments.map((i) => installmentToItem(i, lookups, scope.ids)),
    ]);
    const limit = q.limit ?? DEFAULT_LIMIT;

    let reconciled: {
      date: string;
      balance: number;
      stale: boolean;
      /** Lo de ese día anotado después de este momento quedó por encima de la marca. */
      moment: string | null;
    } | null = null;
    const acc = scope.account;
    if (acc?.reconciledAt && acc.reconciledBalance !== null) {
      const stale = await this.ledger.staleReconciles(userId, [acc]);
      reconciled = {
        date: toDateKey(acc.reconciledAt),
        balance: decimalToNumber(acc.reconciledBalance),
        stale: stale.has(acc.id),
        moment: acc.reconciledMoment?.toISOString() ?? null,
      };
    }

    return {
      items: items.slice(0, limit),
      totals: movementTotals(items),
      /** Hay más de lo que se muestra (los totales sí son de todo). */
      truncated: items.length > limit || txRows.length > MAX_ROWS,
      reconciled,
    };
  }
}
