import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceAccountKind,
  FinanceTxSource,
  FinanceTxType,
  type FinanceAccount,
} from '@prisma/client';
import { localTodayKey, parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFinanceAccountDto,
  ReconcileAccountDto,
  UpdateFinanceAccountDto,
} from './dto/account.dto';
import { decimalToNumber, roundMoney, roundPesos } from './fernance.utils';
import { FernanceLedgerService } from './fernance-ledger.service';

export function serializeAccount(
  a: FinanceAccount,
  extra: { balance?: number | null; reconcileStale?: boolean } = {},
) {
  return {
    id: a.id,
    userId: a.userId,
    name: a.name,
    /** El libro: Personal, Negocio u Otro. */
    type: a.type,
    kind: a.kind,
    institution: a.institution,
    last4: a.last4,
    currency: a.currency,
    color: a.color,
    openingBalance: decimalToNumber(a.openingBalance),
    /** Último cuadre con el banco (AAAA-MM-DD): hasta ese día todo cuadra. */
    reconciledAt: a.reconciledAt ? toDateKey(a.reconciledAt) : null,
    reconciledBalance:
      a.reconciledBalance === null
        ? null
        : decimalToNumber(a.reconciledBalance),
    /** Momento del cuadre (si fue con el saldo de ese mismo día). */
    reconciledMoment: a.reconciledMoment?.toISOString() ?? null,
    /** Algo de lo ya cuadrado cambió: ya no cuadra. */
    reconcileStale: extra.reconcileStale ?? false,
    /** Saldo de hoy. */
    balance: extra.balance ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    archivedAt: a.archivedAt?.toISOString() ?? null,
  };
}

const cleanInstitution = (v: string | undefined) =>
  v === undefined ? undefined : v.trim() || null;
const cleanLast4 = (v: string | undefined) =>
  v === undefined ? undefined : v.trim() || null;

/**
 * Cuentas de FerFinance: las de verdad (ahorros, efectivo, Nequi, tarjetas…) dentro de dos libros separados
 * (Personal y Negocio), con su saldo que se mueve solo y el cuadre con el banco. Borrar una cuenta la archiva
 * (papelera); solo una archivada se puede borrar para siempre.
 */
@Injectable()
export class FernanceAccountsService {
  constructor(
    private prisma: PrismaService,
    private ledger: FernanceLedgerService,
  ) {}

  /** La cuenta, si es tuya (archivada o no). */
  async assertAccount(
    userId: string,
    accountId: string,
  ): Promise<FinanceAccount> {
    const account = await this.prisma.financeAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundException('No encontré esa cuenta.');
    return account;
  }

  /** La cuenta, si es tuya y no está archivada: para anotar algo nuevo en ella. */
  async assertActiveAccount(
    userId: string,
    accountId: string,
  ): Promise<FinanceAccount> {
    const account = await this.assertAccount(userId, accountId);
    if (account.archivedAt)
      throw new BadRequestException(
        `La cuenta «${account.name}» está archivada: restáurala para usarla.`,
      );
    return account;
  }

  private async withBalances(userId: string, rows: FinanceAccount[]) {
    if (!rows.length) return [];
    const [balances, stale] = await Promise.all([
      this.ledger.balances(
        userId,
        localTodayKey(),
        rows.map((r) => r.id),
      ),
      this.ledger.staleReconciles(userId, rows),
    ]);
    return rows.map((r) =>
      serializeAccount(r, {
        balance: balances.get(r.id) ?? 0,
        reconcileStale: stale.has(r.id),
      }),
    );
  }

  async list(userId: string, includeArchived = false) {
    const rows = await this.prisma.financeAccount.findMany({
      where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: { createdAt: 'asc' },
    });
    return this.withBalances(userId, rows);
  }

  async getOne(userId: string, id: string) {
    const [row] = await this.withBalances(userId, [
      await this.assertAccount(userId, id),
    ]);
    return row;
  }

  async create(userId: string, dto: CreateFinanceAccountDto) {
    const row = await this.prisma.financeAccount.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type,
        kind: dto.kind ?? FinanceAccountKind.OTHER,
        color: dto.color ?? '#D4AF37',
        institution: cleanInstitution(dto.institution) ?? null,
        last4: cleanLast4(dto.last4) ?? null,
        openingBalance:
          dto.openingBalance !== undefined ? roundPesos(dto.openingBalance) : 0,
      },
    });
    return this.getOne(userId, row.id);
  }

  async update(userId: string, id: string, dto: UpdateFinanceAccountDto) {
    await this.assertAccount(userId, id);
    await this.prisma.financeAccount.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        kind: dto.kind,
        color: dto.color,
        institution: cleanInstitution(dto.institution),
        last4: cleanLast4(dto.last4),
        openingBalance:
          dto.openingBalance !== undefined
            ? roundPesos(dto.openingBalance)
            : undefined,
      },
    });
    return this.getOne(userId, id);
  }

  /**
   * Cuadrar con el banco: con el saldo que dice el banco, crea el ajuste que falte y marca «revisado hasta aquí».
   * El ajuste queda en la fecha del saldo, así que los saldos de después también cuadran.
   * Si el saldo es de hoy, se guarda el momento: lo que se anote después ese mismo día ya no estaba en el saldo
   * del banco y no daña el cuadre. Si es de un día que ya pasó, ese día está cerrado: cualquier cambio lo daña.
   */
  async reconcile(userId: string, id: string, dto: ReconcileAccountDto) {
    const account = await this.assertActiveAccount(userId, id);
    const todayKey = localTodayKey();
    const dateKey = dto.date ?? todayKey;
    if (dateKey > todayKey)
      throw new BadRequestException(
        'El saldo del banco no puede ser de una fecha que no ha llegado.',
      );
    const bank = roundPesos(dto.balance);
    const current =
      (await this.ledger.balances(userId, dateKey, [id])).get(id) ?? 0;
    const diff = roundMoney(bank - current);
    const adjust = Math.abs(diff) >= 1;
    const moment = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (adjust)
        await tx.financeTransaction.create({
          data: {
            userId,
            type: FinanceTxType.ADJUSTMENT,
            accountId: account.id,
            amount: diff,
            date: parseDateKey(dateKey),
            note: 'Cuadre con el banco',
            source: FinanceTxSource.RECONCILE,
            createdAt: moment,
          },
        });
      await tx.financeAccount.update({
        where: { id },
        data: {
          reconciledAt: parseDateKey(dateKey),
          reconciledBalance: bank,
          reconciledMoment: dateKey === todayKey ? moment : null,
        },
      });
    });
    return {
      account: await this.getOne(userId, id),
      /** Lo que se ajustó (+ subió, − bajó, 0 ya cuadraba). */
      adjustment: adjust ? diff : 0,
      /** El saldo que tenía FerFinance ese día, antes del ajuste. */
      previousBalance: current,
    };
  }

  /** Mandar a la papelera. */
  async archive(userId: string, id: string) {
    const account = await this.assertAccount(userId, id);
    if (account.archivedAt) return serializeAccount(account);
    const row = await this.prisma.financeAccount.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return serializeAccount(row);
  }

  async restore(userId: string, id: string) {
    await this.assertAccount(userId, id);
    await this.prisma.financeAccount.update({
      where: { id },
      data: { archivedAt: null },
    });
    return this.getOne(userId, id);
  }

  /**
   * Borrar para siempre, con sus movimientos y créditos. Solo desde la papelera. Las transferencias con otras
   * cuentas no se pierden: quedan como ingreso o gasto en la otra cuenta, para que su saldo no cambie.
   */
  async purge(userId: string, id: string) {
    const account = await this.assertAccount(userId, id);
    if (!account.archivedAt)
      throw new BadRequestException(
        'Primero archiva la cuenta; desde la papelera se borra para siempre.',
      );
    await this.prisma.$transaction(async (tx) => {
      const transfers = await tx.financeTransaction.findMany({
        where: {
          userId,
          type: FinanceTxType.TRANSFER,
          OR: [{ accountId: id }, { toAccountId: id }],
        },
      });
      for (const t of transfers) {
        if (t.accountId === id && t.toAccountId && t.toAccountId !== id) {
          await tx.financeTransaction.update({
            where: { id: t.id },
            data: {
              type: FinanceTxType.INCOME,
              accountId: t.toAccountId,
              toAccountId: null,
              note:
                t.note ??
                `Transferencia desde «${account.name}» (cuenta borrada)`,
            },
          });
        } else if (t.toAccountId === id && t.accountId !== id) {
          await tx.financeTransaction.update({
            where: { id: t.id },
            data: {
              type: FinanceTxType.EXPENSE,
              toAccountId: null,
              note:
                t.note ?? `Transferencia a «${account.name}» (cuenta borrada)`,
            },
          });
        }
      }
      await tx.financeAccount.delete({ where: { id } });
    });
    return { ok: true };
  }
}
