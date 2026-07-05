import { Injectable, NotFoundException } from '@nestjs/common';
import { parseDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncomeDto, UpdateIncomeDto } from './dto/income.dto';
import { decimalToNumber } from './fernance.utils';
import { FernanceAccountsService } from './fernance-accounts.service';

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
    date: row.date.toISOString().slice(0, 10),
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
    const where: {
      userId: string;
      accountId?: string;
      date?: { gte?: Date; lte?: Date };
    } = { userId };
    if (accountId) {
      await this.accounts.assertAccount(userId, accountId);
      where.accountId = accountId;
    }
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = parseDateKey(from);
      if (to) where.date.lte = parseDateKey(to);
    }
    const rows = await this.prisma.income.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { account: { select: { id: true, name: true, color: true } } },
    });
    return rows.map(serializeIncome);
  }

  async create(userId: string, dto: CreateIncomeDto) {
    await this.accounts.assertAccount(userId, dto.accountId);
    const row = await this.prisma.income.create({
      data: {
        userId,
        accountId: dto.accountId,
        amount: dto.amount,
        date: parseDateKey(dto.date),
        description: dto.description?.trim() || null,
      },
      include: { account: { select: { id: true, name: true, color: true } } },
    });
    return serializeIncome(row);
  }

  async update(userId: string, id: string, dto: UpdateIncomeDto) {
    const existing = await this.prisma.income.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Ingreso no encontrado');
    if (dto.accountId) await this.accounts.assertAccount(userId, dto.accountId);
    const row = await this.prisma.income.update({
      where: { id },
      data: {
        accountId: dto.accountId,
        amount: dto.amount,
        date: dto.date ? parseDateKey(dto.date) : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
      },
      include: { account: { select: { id: true, name: true, color: true } } },
    });
    return serializeIncome(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.income.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Ingreso no encontrado');
    await this.prisma.income.delete({ where: { id } });
    return { ok: true };
  }
}
