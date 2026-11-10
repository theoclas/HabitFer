import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceTxSource, FinanceTxType, type Prisma } from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncomeDto, UpdateIncomeDto } from './dto/income.dto';
import { decimalToNumber, roundPesos } from './fernance.utils';
import { FernanceAccountsService } from './fernance-accounts.service';

const ACCOUNT_SELECT = {
  select: { id: true, name: true, color: true },
} as const;

function serializeIncome(row: {
  id: string;
  userId: string;
  accountId: string;
  amount: { toString(): string };
  date: Date;
  note: string | null;
  createdAt: Date;
  account?: { id: string; name: string; color: string | null };
}) {
  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    amount: decimalToNumber(row.amount),
    date: toDateKey(row.date),
    description: row.note,
    createdAt: row.createdAt.toISOString(),
    account: row.account,
  };
}

/**
 * Ingresos con la forma de antes (para la app que todavía no se actualiza). Desde la fase 1 los ingresos son
 * movimientos (FinanceTransaction de tipo INCOME); aquí solo se leen y escriben con el formato viejo.
 */
@Injectable()
export class FernanceIncomesService {
  constructor(
    private prisma: PrismaService,
    private accounts: FernanceAccountsService,
  ) {}

  async list(userId: string, accountId?: string, from?: string, to?: string) {
    const where: Prisma.FinanceTransactionWhereInput = {
      userId,
      type: FinanceTxType.INCOME,
    };
    if (accountId) {
      await this.accounts.assertAccount(userId, accountId);
      where.accountId = accountId;
    } else {
      // Lo de las cuentas en la papelera no sale.
      where.account = { archivedAt: null };
    }
    if (from || to) {
      where.date = {
        ...(from ? { gte: parseDateKey(from) } : {}),
        ...(to ? { lte: parseDateKey(to) } : {}),
      };
    }
    const rows = await this.prisma.financeTransaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { account: ACCOUNT_SELECT },
    });
    return rows.map(serializeIncome);
  }

  async create(userId: string, dto: CreateIncomeDto) {
    await this.accounts.assertActiveAccount(userId, dto.accountId);
    const row = await this.prisma.financeTransaction.create({
      data: {
        userId,
        type: FinanceTxType.INCOME,
        accountId: dto.accountId,
        amount: roundPesos(dto.amount),
        date: parseDateKey(dto.date),
        note: dto.description?.trim() || null,
        source: FinanceTxSource.MANUAL,
      },
      include: { account: ACCOUNT_SELECT },
    });
    return serializeIncome(row);
  }

  private async assertIncome(userId: string, id: string) {
    const existing = await this.prisma.financeTransaction.findFirst({
      where: { id, userId, type: FinanceTxType.INCOME },
    });
    if (!existing) throw new NotFoundException('No encontré ese ingreso.');
    return existing;
  }

  async update(userId: string, id: string, dto: UpdateIncomeDto) {
    const existing = await this.assertIncome(userId, id);
    if (dto.accountId && dto.accountId !== existing.accountId)
      await this.accounts.assertActiveAccount(userId, dto.accountId);
    const row = await this.prisma.financeTransaction.update({
      where: { id },
      data: {
        accountId: dto.accountId,
        amount: dto.amount !== undefined ? roundPesos(dto.amount) : undefined,
        date: dto.date ? parseDateKey(dto.date) : undefined,
        note:
          dto.description !== undefined
            ? dto.description.trim() || null
            : undefined,
      },
      include: { account: ACCOUNT_SELECT },
    });
    return serializeIncome(row);
  }

  async remove(userId: string, id: string) {
    await this.assertIncome(userId, id);
    await this.prisma.financeTransaction.delete({ where: { id } });
    return { ok: true };
  }
}
