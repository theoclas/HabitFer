import { Injectable, NotFoundException } from '@nestjs/common';
import { localTodayKey, parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToNumber, parseRange } from './fernance.utils';
import { paidKeyOf } from './fernance-credits.service';
import { buildSummary } from './fernance-summary.utils';

@Injectable()
export class FernanceSummaryService {
  constructor(private prisma: PrismaService) {}

  async getSummary(
    userId: string,
    accountId?: string,
    from?: string,
    to?: string,
  ) {
    const todayKey = localTodayKey();
    const range = parseRange(from, to, todayKey);

    const accounts = await this.prisma.financeAccount.findMany({
      where: { userId },
      select: { id: true, name: true, archivedAt: true },
    });
    const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
    if (accountId && !accountNames.has(accountId))
      throw new NotFoundException('No encontré esa cuenta.');
    // Lo de las cuentas en la papelera no cuenta (salvo que se pida esa cuenta).
    const archived = accounts
      .filter((a) => a.archivedAt !== null)
      .map((a) => a.id);
    const accountWhere = accountId
      ? {}
      : archived.length
        ? { accountId: { notIn: archived } }
        : {};

    const [incomes, credits] = await Promise.all([
      this.prisma.income.findMany({
        where: {
          userId,
          ...(accountId ? { accountId } : accountWhere),
          date: { gte: parseDateKey(range.from), lte: parseDateKey(range.to) },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.credit.findMany({
        where: { userId, ...accountWhere },
        include: { installments: true },
      }),
    ]);

    return buildSummary({
      range,
      todayKey,
      accountId: accountId ?? null,
      accountNames,
      incomes: incomes.map((inc) => ({
        id: inc.id,
        dateKey: toDateKey(inc.date),
        amount: decimalToNumber(inc.amount),
        label: inc.description || 'Ingreso',
        accountId: inc.accountId,
        accountName: accountNames.get(inc.accountId) ?? 'Cuenta',
      })),
      credits: credits.map((c) => ({
        id: c.id,
        name: c.name,
        accountId: c.accountId,
        status: c.status,
        installments: c.installments.map((i) => ({
          id: i.id,
          dueKey: toDateKey(i.dueDate),
          amount: decimalToNumber(i.amount),
          status: i.status,
          paidKey: paidKeyOf(i),
          paidAmount:
            i.paidAmount === null ? null : decimalToNumber(i.paidAmount),
          paidAccountId: i.paidAccountId,
        })),
      })),
    });
  }
}
