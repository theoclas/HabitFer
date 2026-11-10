import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreditStatus,
  FinanceAccountType,
  InstallmentStatus,
  type Prisma,
} from '@prisma/client';
import { localTodayKey, parseDateKey, toDateKey } from '../common/date.utils';
import {
  cleanText,
  normTitle,
  oneOf,
  toCsv,
  validDateKey,
} from '../export/export.utils';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToNumber, MAX_AMOUNT, roundPesos } from './fernance.utils';
import { paidKeyOf } from './fernance-credits.service';

export const FINANCE_BACKUP_APP = 'FerFinance';
export const FINANCE_BACKUP_VERSION = 1;
const MAX_ROWS = 50_000;
const MAX_DATE = '2200-12-31';
const HEX = /^#[0-9A-Fa-f]{6}$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v))
    throw new BadRequestException(
      'El respaldo de FerFinance tiene un formato inesperado.',
    );
  if (v.length > MAX_ROWS)
    throw new BadRequestException(
      'El respaldo es demasiado grande para importarlo de una vez.',
    );
  return v;
};
const money = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0.01 && v <= MAX_AMOUNT
    ? Math.round(v * 100) / 100
    : null;
const instant = (v: unknown): Date | null => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export type FinanceImportReport = {
  accounts: number;
  incomes: number;
  credits: number;
  installments: number;
};

/**
 * Respaldo de FerFinance: cuentas (también las archivadas), ingresos y créditos con sus cuotas, en JSON (también
 * dentro del respaldo de HabitFer) y los movimientos en CSV para Excel. Importar suma lo que falta y nunca borra
 * ni cambia lo que ya existe.
 */
@Injectable()
export class FinanceExportService {
  constructor(private prisma: PrismaService) {}

  async exportJson(userId: string) {
    const [accounts, incomes, credits] = await Promise.all([
      this.prisma.financeAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.income.findMany({
        where: { userId },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.credit.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: { installments: { orderBy: { dueDate: 'asc' } } },
      }),
    ]);
    return {
      app: FINANCE_BACKUP_APP,
      version: FINANCE_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        color: a.color,
        archivedAt: a.archivedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      incomes: incomes.map((i) => ({
        id: i.id,
        accountId: i.accountId,
        amount: decimalToNumber(i.amount),
        date: toDateKey(i.date),
        description: i.description,
        createdAt: i.createdAt.toISOString(),
      })),
      credits: credits.map((c) => ({
        id: c.id,
        accountId: c.accountId,
        name: c.name,
        totalAmount: decimalToNumber(c.totalAmount),
        installmentAmount: decimalToNumber(c.installmentAmount),
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        installments: c.installments.map((i) => ({
          dueDate: toDateKey(i.dueDate),
          amount: decimalToNumber(i.amount),
          status: i.status,
          paidAt: i.paidAt?.toISOString() ?? null,
          paidDate: paidKeyOf(i),
          paidAmount:
            i.paidAmount === null ? null : decimalToNumber(i.paidAmount),
          paidAccountId: i.paidAccountId,
        })),
      })),
    };
  }

  /** Movimientos en CSV: ingresos y cuotas (pagadas y pendientes), una fila por movimiento. */
  async exportCsv(userId: string): Promise<string> {
    const data = await this.exportJson(userId);
    const today = localTodayKey();
    const accountName = new Map(
      data.accounts.map((a) => [
        a.id,
        a.archivedAt ? `${a.name} (archivada)` : a.name,
      ]),
    );
    const rows: { date: string; cells: (string | number | null)[] }[] = [];
    for (const i of data.incomes) {
      rows.push({
        date: i.date,
        cells: [
          i.date,
          'ingreso',
          i.description || 'Ingreso',
          accountName.get(i.accountId) ?? '',
          i.amount,
          '',
          'recibido',
        ],
      });
    }
    for (const c of data.credits) {
      const n = c.installments.length;
      c.installments.forEach((i, k) => {
        const label = `Cuota ${k + 1} de ${n}`;
        if (i.status === InstallmentStatus.PAID) {
          const date = i.paidDate ?? i.dueDate;
          const account = accountName.get(i.paidAccountId ?? c.accountId) ?? '';
          rows.push({
            date,
            cells: [
              date,
              'cuota pagada',
              label,
              account,
              -(i.paidAmount ?? i.amount),
              c.name,
              'pagada',
            ],
          });
        } else if (i.status === InstallmentStatus.PENDING) {
          const estado =
            c.status === CreditStatus.CANCELLED
              ? 'cancelada'
              : i.dueDate < today
                ? 'vencida'
                : 'pendiente';
          rows.push({
            date: i.dueDate,
            cells: [
              i.dueDate,
              'cuota pendiente',
              label,
              accountName.get(c.accountId) ?? '',
              -i.amount,
              c.name,
              estado,
            ],
          });
        }
      });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return toCsv([
      ['fecha', 'tipo', 'descripción', 'cuenta', 'monto', 'crédito', 'estado'],
      ...rows.map((r) => r.cells),
    ]);
  }

  /** Importar un respaldo de FerFinance (o la parte `finance` del de HabitFer): suma lo que falta. */
  async importJson(
    userId: string,
    body: unknown,
  ): Promise<FinanceImportReport> {
    if (
      !isObj(body) ||
      body.app !== FINANCE_BACKUP_APP ||
      body.version !== FINANCE_BACKUP_VERSION
    ) {
      throw new BadRequestException(
        'Este archivo no es un respaldo de FerFinance.',
      );
    }
    const report: FinanceImportReport = {
      accounts: 0,
      incomes: 0,
      credits: 0,
      installments: 0,
    };

    // Cuentas: la misma si coincide el id (tuyo) o el nombre.
    const mine = await this.prisma.financeAccount.findMany({
      where: { userId },
    });
    const byId = new Map(mine.map((a) => [a.id, a.id]));
    const byName = new Map(mine.map((a) => [normTitle(a.name), a.id]));
    const accountMap = new Map<string, string>();
    for (const r of list(body.accounts).filter(isObj)) {
      const srcId = typeof r.id === 'string' ? r.id : null;
      const name = cleanText(r.name, 120);
      if (!srcId || !name) continue;
      const found = byId.get(srcId) ?? byName.get(normTitle(name));
      if (found) {
        accountMap.set(srcId, found);
        continue;
      }
      const archivedAt = instant(r.archivedAt);
      const created = await this.prisma.financeAccount.create({
        data: {
          userId,
          name,
          type: oneOf(
            r.type,
            [
              FinanceAccountType.PERSONAL,
              FinanceAccountType.BUSINESS,
              FinanceAccountType.OTHER,
            ],
            FinanceAccountType.PERSONAL,
          ),
          currency:
            typeof r.currency === 'string' && /^[A-Z]{3}$/.test(r.currency)
              ? r.currency
              : 'COP',
          color:
            typeof r.color === 'string' && HEX.test(r.color)
              ? r.color
              : '#D4AF37',
          archivedAt,
        },
      });
      accountMap.set(srcId, created.id);
      byName.set(normTitle(name), created.id);
      report.accounts++;
    }

    // Ingresos: ya está si coinciden cuenta, día, monto y descripción.
    const existing = await this.prisma.income.findMany({
      where: { userId },
      select: { accountId: true, date: true, amount: true, description: true },
    });
    const incomeKey = (
      accountId: string,
      date: string,
      amount: number,
      desc: string | null,
    ) => `${accountId}|${date}|${Math.round(amount)}|${desc ?? ''}`;
    const seen = new Set(
      existing.map((e) =>
        incomeKey(
          e.accountId,
          toDateKey(e.date),
          decimalToNumber(e.amount),
          e.description,
        ),
      ),
    );
    const incomes: Prisma.IncomeCreateManyInput[] = [];
    for (const r of list(body.incomes).filter(isObj)) {
      const accountId =
        typeof r.accountId === 'string'
          ? accountMap.get(r.accountId)
          : undefined;
      const date = validDateKey(r.date, MAX_DATE);
      const amount = money(r.amount);
      if (!accountId || !date || amount === null) continue;
      const description = cleanText(r.description, 200);
      const k = incomeKey(accountId, date, amount, description);
      if (seen.has(k)) continue;
      seen.add(k);
      incomes.push({
        userId,
        accountId,
        date: parseDateKey(date),
        amount,
        description,
      });
    }
    if (incomes.length)
      report.incomes = (
        await this.prisma.income.createMany({ data: incomes })
      ).count;

    // Créditos: el mismo si coincide el id (tuyo) o el nombre en la misma cuenta. De uno que ya existe solo se
    // suman las cuotas que falten (mismo día y valor).
    const credits = await this.prisma.credit.findMany({
      where: { userId },
      include: { installments: { select: { dueDate: true, amount: true } } },
    });
    const creditById = new Map(credits.map((c) => [c.id, c]));
    const creditByName = new Map(
      credits.map((c) => [`${c.accountId}|${normTitle(c.name)}`, c]),
    );
    for (const r of list(body.credits).filter(isObj)) {
      const accountId =
        typeof r.accountId === 'string'
          ? accountMap.get(r.accountId)
          : undefined;
      const name = cleanText(r.name, 120);
      if (!accountId || !name) continue;
      const installments = this.installmentsFrom(r.installments, accountMap);
      if (!installments.length) continue;
      const found =
        (typeof r.id === 'string' ? creditById.get(r.id) : undefined) ??
        creditByName.get(`${accountId}|${normTitle(name)}`);
      if (found) {
        const have = new Set(
          found.installments.map(
            (i) =>
              `${toDateKey(i.dueDate)}|${Math.round(decimalToNumber(i.amount))}`,
          ),
        );
        const missing = installments.filter(
          (i) => !have.has(`${toDateKey(i.dueDate)}|${Math.round(i.amount)}`),
        );
        if (missing.length) {
          report.installments += (
            await this.prisma.creditInstallment.createMany({
              data: missing.map((i) => ({ ...i, creditId: found.id })),
            })
          ).count;
        }
        continue;
      }
      const total = installments.reduce((s, i) => s + i.amount, 0);
      const pending = installments.some(
        (i) => i.status === InstallmentStatus.PENDING,
      );
      const status =
        r.status === CreditStatus.CANCELLED
          ? CreditStatus.CANCELLED
          : pending
            ? CreditStatus.ACTIVE
            : CreditStatus.PAID_OFF;
      await this.prisma.credit.create({
        data: {
          userId,
          accountId,
          name,
          totalAmount: total,
          installmentAmount:
            money(r.installmentAmount) ?? roundPesos(installments[0].amount),
          status,
          datesCheckedAt: new Date(),
          installments: { create: installments },
        },
      });
      report.credits++;
      report.installments += installments.length;
    }
    return report;
  }

  private installmentsFrom(value: unknown, accountMap: Map<string, string>) {
    return list(value)
      .filter(isObj)
      .flatMap((i) => {
        const due = validDateKey(i.dueDate, MAX_DATE);
        const amount = money(i.amount);
        if (!due || amount === null) return [];
        const paid = i.status === InstallmentStatus.PAID;
        const paidKey = paid ? validDateKey(i.paidDate, MAX_DATE) : null;
        const paidAccountId =
          paid && typeof i.paidAccountId === 'string'
            ? (accountMap.get(i.paidAccountId) ?? null)
            : null;
        return [
          {
            dueDate: parseDateKey(due),
            amount,
            status: paid ? InstallmentStatus.PAID : InstallmentStatus.PENDING,
            paidAt: paid
              ? (instant(i.paidAt) ??
                (paidKey ? parseDateKey(paidKey) : new Date()))
              : null,
            paidDate: paidKey ? parseDateKey(paidKey) : null,
            paidAmount: paid ? money(i.paidAmount) : null,
            paidAccountId,
          },
        ];
      });
  }
}
