import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InstallmentStatus,
  type FinanceAccount,
  type FinanceAccountType,
  type Prisma,
} from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToNumber, paidKeyOf } from './fernance.utils';
import {
  combineBalances,
  type MovementLookups,
} from './fernance-movements.utils';

export type Scope = {
  /** Todas las cuentas de la persona (también las archivadas, para los nombres). */
  accounts: FinanceAccount[];
  /** Las que se miran. */
  ids: Set<string>;
  /** La cuenta del filtro, si se pidió una. */
  account: FinanceAccount | null;
};

/**
 * El libro mayor de FerFinance: qué cuentas se miran (una, un libro o todas), cuánto tiene cada una y los nombres
 * para mostrar los movimientos.
 */
@Injectable()
export class FernanceLedgerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Una cuenta (aunque esté archivada: se pidió esa), las activas de un libro o todas las activas.
   * Lo de las cuentas en la papelera no sale si no se pide.
   */
  async scope(
    userId: string,
    accountId?: string | null,
    book?: FinanceAccountType | null,
  ): Promise<Scope> {
    const accounts = await this.prisma.financeAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (accountId) {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) throw new NotFoundException('No encontré esa cuenta.');
      return { accounts, ids: new Set([account.id]), account };
    }
    const ids = new Set(
      accounts
        .filter((a) => !a.archivedAt && (!book || a.type === book))
        .map((a) => a.id),
    );
    return { accounts, ids, account: null };
  }

  /** Nombres y colores de las cuentas, nombres e íconos de las categorías (también las archivadas). */
  async lookups(
    userId: string,
    accounts?: FinanceAccount[],
  ): Promise<MovementLookups> {
    const [accs, cats] = await Promise.all([
      accounts ?? this.prisma.financeAccount.findMany({ where: { userId } }),
      this.prisma.financeCategory.findMany({
        where: { userId },
        select: { id: true, name: true, icon: true },
      }),
    ]);
    return {
      accounts: new Map(
        accs.map((a) => [a.id, { name: a.name, color: a.color }]),
      ),
      categories: new Map(
        cats.map((c) => [c.id, { name: c.name, icon: c.icon }]),
      ),
    };
  }

  /**
   * Saldo de cada cuenta al final del día `untilKey`: lo inicial, más lo que entró, menos lo que salió.
   * Con `moment`, de ese último día solo cuenta lo anotado hasta ese momento (el saldo en el momento de un cuadre).
   */
  async balances(
    userId: string,
    untilKey: string,
    accountIds?: string[],
    moment?: Date | null,
  ): Promise<Map<string, number>> {
    const until = parseDateKey(untilKey);
    const accounts = await this.prisma.financeAccount.findMany({
      where: { userId, ...(accountIds ? { id: { in: accountIds } } : {}) },
      select: { id: true, openingBalance: true },
    });
    const ids = accounts.map((a) => a.id);
    if (!ids.length) return new Map();
    const dateWhere: Prisma.FinanceTransactionWhereInput = moment
      ? {
          OR: [
            { date: { lt: until } },
            { date: until, createdAt: { lte: moment } },
          ],
        }
      : { date: { lte: until } };
    const [sums, transfersIn, paid] = await Promise.all([
      this.prisma.financeTransaction.groupBy({
        by: ['accountId', 'type'],
        where: { userId, accountId: { in: ids }, ...dateWhere },
        _sum: { amount: true },
      }),
      this.prisma.financeTransaction.groupBy({
        by: ['toAccountId'],
        where: {
          userId,
          type: 'TRANSFER',
          toAccountId: { in: ids },
          ...dateWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.creditInstallment.findMany({
        where: { status: InstallmentStatus.PAID, credit: { userId } },
        select: {
          amount: true,
          status: true,
          dueDate: true,
          paidAt: true,
          paidDate: true,
          paidAmount: true,
          paidAccountId: true,
          credit: { select: { accountId: true } },
        },
      }),
    ]);
    const wanted = new Set(ids);
    const installmentsPaid = paid.flatMap((i) => {
      const key = paidKeyOf(i);
      const accountId = i.paidAccountId ?? i.credit.accountId;
      if (!key || key > untilKey || !wanted.has(accountId)) return [];
      // Una cuota de ese mismo día marcada después del cuadre todavía no contaba.
      if (moment && key === untilKey && i.paidAt && i.paidAt > moment)
        return [];
      return [{ accountId, amount: decimalToNumber(i.paidAmount ?? i.amount) }];
    });
    return combineBalances(
      accounts.map((a) => ({
        id: a.id,
        openingBalance: decimalToNumber(a.openingBalance),
      })),
      sums.map((s) => ({
        accountId: s.accountId,
        type: s.type,
        sum: decimalToNumber(s._sum.amount),
      })),
      transfersIn.flatMap((t) =>
        t.toAccountId
          ? [{ accountId: t.toAccountId, sum: decimalToNumber(t._sum.amount) }]
          : [],
      ),
      installmentsPaid,
    );
  }

  /**
   * ¿Sigue cuadrando el último cuadre? Si alguien cambió algo de lo que ya estaba cuadrado (de antes, o de ese día
   * pero anotado antes del cuadre), el saldo de ese momento ya no es el que dijo el banco. Lo que se anote después
   * del cuadre no lo daña. Devuelve las cuentas cuyo cuadre quedó desactualizado.
   */
  async staleReconciles(
    userId: string,
    accounts: FinanceAccount[],
  ): Promise<Set<string>> {
    const stale = new Set<string>();
    for (const a of accounts) {
      if (!a.reconciledAt || a.reconciledBalance === null) continue;
      const balances = await this.balances(
        userId,
        toDateKey(a.reconciledAt),
        [a.id],
        a.reconciledMoment,
      );
      const diff =
        (balances.get(a.id) ?? 0) - decimalToNumber(a.reconciledBalance);
      if (Math.abs(diff) >= 1) stale.add(a.id);
    }
    return stale;
  }
}
