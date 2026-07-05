import { Injectable } from '@nestjs/common';
import { InstallmentStatus } from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToNumber, isDateInRange, parseRange, roundMoney, toLocalDateKey } from './fernance.utils';
import { FernanceAccountsService } from './fernance-accounts.service';

type Movement = {
  id: string;
  type: 'income' | 'installment_paid' | 'installment_pending';
  date: string;
  amount: number;
  label: string;
  accountId: string;
  accountName: string;
  creditId?: string;
  installmentId?: string;
  status?: string;
};

type ProjectionMonth = {
  month: string;
  label: string;
  total: number;
  installments: { id: string; creditId: string; creditName: string; dueDate: string; amount: number }[];
};

@Injectable()
export class FernanceSummaryService {
  constructor(
    private prisma: PrismaService,
    private accounts: FernanceAccountsService,
  ) {}

  async getSummary(userId: string, accountId?: string, from?: string, to?: string) {
    const range = parseRange(from, to);
    if (accountId) await this.accounts.assertAccount(userId, accountId);

    const accountFilter = accountId ? { accountId } : { userId };

    const incomes = await this.prisma.income.findMany({
      where: {
        ...accountFilter,
        date: { gte: parseDateKey(range.from), lte: parseDateKey(range.to) },
      },
      include: { account: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    });

    const credits = await this.prisma.credit.findMany({
      where: accountFilter,
      include: {
        account: { select: { id: true, name: true } },
        installments: true,
      },
    });

    let totalIncome = 0;
    let totalPaid = 0;
    let committed = 0;
    const movements: Movement[] = [];

    for (const inc of incomes) {
      const amount = decimalToNumber(inc.amount);
      totalIncome = roundMoney(totalIncome + amount);
      movements.push({
        id: inc.id,
        type: 'income',
        date: toDateKey(inc.date),
        amount,
        label: inc.description || 'Ingreso',
        accountId: inc.accountId,
        accountName: inc.account.name,
      });
    }

    const projectionMap = new Map<string, ProjectionMonth>();

    for (const credit of credits) {
      for (const inst of credit.installments) {
        const amount = decimalToNumber(inst.amount);
        const dueKey = toDateKey(inst.dueDate);

        if (inst.status === InstallmentStatus.PAID && inst.paidAt) {
          const paidKey = toLocalDateKey(inst.paidAt);
          if (isDateInRange(paidKey, range.from, range.to)) {
            totalPaid = roundMoney(totalPaid + amount);
            movements.push({
              id: inst.id,
              type: 'installment_paid',
              date: paidKey,
              amount: -amount,
              label: `Cuota: ${credit.name}`,
              accountId: credit.accountId,
              accountName: credit.account.name,
              creditId: credit.id,
              installmentId: inst.id,
              status: 'PAID',
            });
          }
        } else if (inst.status === InstallmentStatus.PENDING) {
          if (isDateInRange(dueKey, range.from, range.to)) {
            committed = roundMoney(committed + amount);
            movements.push({
              id: inst.id,
              type: 'installment_pending',
              date: dueKey,
              amount: -amount,
              label: `Cuota pendiente: ${credit.name}`,
              accountId: credit.accountId,
              accountName: credit.account.name,
              creditId: credit.id,
              installmentId: inst.id,
              status: 'PENDING',
            });
          } else if (dueKey > range.to) {
            const month = dueKey.slice(0, 7);
            if (!projectionMap.has(month)) {
              projectionMap.set(month, {
                month,
                label: month,
                total: 0,
                installments: [],
              });
            }
            const bucket = projectionMap.get(month)!;
            bucket.total = roundMoney(bucket.total + amount);
            bucket.installments.push({
              id: inst.id,
              creditId: credit.id,
              creditName: credit.name,
              dueDate: dueKey,
              amount,
            });
          }
        }
      }
    }

    movements.sort((a, b) => a.date.localeCompare(b.date));

    const available = roundMoney(totalIncome - totalPaid);
    const projection = [...projectionMap.values()].sort((a, b) => a.month.localeCompare(b.month));

    return {
      from: range.from,
      to: range.to,
      accountId: accountId ?? null,
      totals: {
        income: totalIncome,
        paidInstallments: totalPaid,
        available,
        committed,
      },
      movements,
      projection,
    };
  }
}
