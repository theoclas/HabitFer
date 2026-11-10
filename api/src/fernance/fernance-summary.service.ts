import { Injectable } from '@nestjs/common';
import type { FinanceAccountType } from '@prisma/client';
import { localTodayKey, parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToNumber, paidKeyOf, parseRange } from './fernance.utils';
import { FernanceLedgerService } from './fernance-ledger.service';
import { buildSummary } from './fernance-summary.utils';
import { toMovementTx } from './fernance-transactions.service';

@Injectable()
export class FernanceSummaryService {
  constructor(
    private prisma: PrismaService,
    private ledger: FernanceLedgerService,
  ) {}

  async getSummary(
    userId: string,
    accountId?: string,
    from?: string,
    to?: string,
    book?: FinanceAccountType,
  ) {
    const todayKey = localTodayKey();
    const range = parseRange(from, to, todayKey);
    // Una cuenta (aunque esté en la papelera: se pidió esa), las activas de un libro o todas las activas.
    const scope = await this.ledger.scope(
      userId,
      accountId,
      accountId ? null : book,
    );
    const ids = [...scope.ids];

    const [txRows, credits, lookups, balances] = await Promise.all([
      ids.length
        ? this.prisma.financeTransaction.findMany({
            where: {
              userId,
              date: {
                gte: parseDateKey(range.from),
                lte: parseDateKey(range.to),
              },
              OR: [{ accountId: { in: ids } }, { toAccountId: { in: ids } }],
            },
          })
        : [],
      this.prisma.credit.findMany({
        where: { userId },
        include: { installments: true },
      }),
      this.ledger.lookups(userId, scope.accounts),
      this.ledger.balances(userId, todayKey, ids),
    ]);

    const summary = buildSummary({
      range,
      todayKey,
      scope: scope.ids,
      accountId: scope.account?.id ?? null,
      book: scope.account ? null : (book ?? null),
      lookups,
      transactions: txRows.map(toMovementTx),
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

    // Saldo de hoy de cada cuenta que se mira (una tarjeta de crédito en negativo = lo que debes).
    const accounts = scope.accounts
      .filter((a) => scope.ids.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        kind: a.kind,
        color: a.color,
        institution: a.institution,
        balance: balances.get(a.id) ?? 0,
        reconciledAt: a.reconciledAt ? toDateKey(a.reconciledAt) : null,
      }));
    const total =
      Math.round(accounts.reduce((s, a) => s + a.balance, 0) * 100) / 100;
    return { ...summary, balances: { total, accounts } };
  }
}
