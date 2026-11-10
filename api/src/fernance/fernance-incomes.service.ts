import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
  description: string | null;
  createdAt: Date;
  account?: { id: string; name: string; color: string | null };
}) {
  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    amount: decimalToNumber(row.amount),
    date: toDateKey(row.date),
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    account: row.account,
  };
}

@Injectable()
export class FernanceIncomesService {
  constructor(
    private prisma: PrismaService,
    private accounts: FernanceAccountsService,
  ) {}

  async list(userId: string, accountId?: string, from?: string, to?: string) {
    const where: Prisma.IncomeWhereInput = { userId };
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
    const rows = await this.prisma.income.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { account: ACCOUNT_SELECT },
    });
    return rows.map(serializeIncome);
  }

  async create(userId: string, dto: CreateIncomeDto) {
    await this.accounts.assertActiveAccount(userId, dto.accountId);
    const row = await this.prisma.income.create({
      data: {
        userId,
        accountId: dto.accountId,
        amount: roundPesos(dto.amount),
        date: parseDateKey(dto.date),
        description: dto.description?.trim() || null,
      },
      include: { account: ACCOUNT_SELECT },
    });
    return serializeIncome(row);
  }

  async update(userId: string, id: string, dto: UpdateIncomeDto) {
    const existing = await this.prisma.income.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('No encontré ese ingreso.');
    if (dto.accountId && dto.accountId !== existing.accountId)
      await this.accounts.assertActiveAccount(userId, dto.accountId);
    const row = await this.prisma.income.update({
      where: { id },
      data: {
        accountId: dto.accountId,
        amount: dto.amount !== undefined ? roundPesos(dto.amount) : undefined,
        date: dto.date ? parseDateKey(dto.date) : undefined,
        description:
          dto.description !== undefined
            ? dto.description.trim() || null
            : undefined,
      },
      include: { account: ACCOUNT_SELECT },
    });
    return serializeIncome(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.income.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('No encontré ese ingreso.');
    await this.prisma.income.delete({ where: { id } });
    return { ok: true };
  }
}
