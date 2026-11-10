import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreditStatus,
  FinanceAccountKind,
  FinanceAccountType,
  FinanceCategoryKind,
  FinanceTxSource,
  FinanceTxType,
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
import {
  decimalToNumber,
  MAX_AMOUNT,
  paidKeyOf,
  roundPesos,
} from './fernance.utils';
import { FernanceCategoriesService } from './fernance-categories.service';
import { normalizeKeyword } from './text/money-text.parse';

export const FINANCE_BACKUP_APP = 'FerFinance';
/** 1 = fase 0 (cuentas, ingresos y créditos). 2 = fase 1 (movimientos, categorías, palabras y «lo de siempre»). */
export const FINANCE_BACKUP_VERSION = 2;
const ACCEPTED_VERSIONS = [1, 2];
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
/** Un saldo o un ajuste: puede ser negativo. */
const signedMoney = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_AMOUNT
    ? Math.round(v * 100) / 100
    : null;
const instant = (v: unknown): Date | null => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export type FinanceImportReport = {
  accounts: number;
  categories: number;
  transactions: number;
  /** Ingresos de un respaldo viejo (versión 1), que entran como movimientos. */
  incomes: number;
  keywords: number;
  shortcuts: number;
  credits: number;
  installments: number;
};

const TX_TYPES = [
  FinanceTxType.INCOME,
  FinanceTxType.EXPENSE,
  FinanceTxType.TRANSFER,
  FinanceTxType.ADJUSTMENT,
];
const TX_TYPE_LABEL: Record<FinanceTxType, string> = {
  INCOME: 'ingreso',
  EXPENSE: 'gasto',
  TRANSFER: 'transferencia',
  ADJUSTMENT: 'ajuste',
};

/**
 * Respaldo de FerFinance: cuentas (también las archivadas), categorías, movimientos, palabras enseñadas, «lo de
 * siempre» y créditos con sus cuotas, en JSON (también dentro del respaldo de HabitFer), y los movimientos en CSV
 * para Excel. Importar suma lo que falta y nunca borra ni cambia lo que ya existe. Acepta los respaldos de antes.
 */
@Injectable()
export class FinanceExportService {
  constructor(
    private prisma: PrismaService,
    private categories: FernanceCategoriesService,
  ) {}

  async exportJson(userId: string) {
    const [accounts, categories, transactions, keywords, shortcuts, credits] =
      await Promise.all([
        this.prisma.financeAccount.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.financeCategory.findMany({
          where: { userId },
          orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
        }),
        this.prisma.financeTransaction.findMany({
          where: { userId },
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        }),
        this.prisma.financeKeyword.findMany({
          where: { userId },
          orderBy: { keyword: 'asc' },
        }),
        this.prisma.financeShortcut.findMany({
          where: { userId },
          orderBy: { sortOrder: 'asc' },
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
        kind: a.kind,
        institution: a.institution,
        last4: a.last4,
        currency: a.currency,
        color: a.color,
        openingBalance: decimalToNumber(a.openingBalance),
        reconciledAt: a.reconciledAt ? toDateKey(a.reconciledAt) : null,
        reconciledBalance:
          a.reconciledBalance === null
            ? null
            : decimalToNumber(a.reconciledBalance),
        reconciledMoment: a.reconciledMoment?.toISOString() ?? null,
        archivedAt: a.archivedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      categories: categories.map((c) => ({
        id: c.id,
        kind: c.kind,
        parentId: c.parentId,
        name: c.name,
        icon: c.icon,
        color: c.color,
        systemKey: c.systemKey,
        sortOrder: c.sortOrder,
        archivedAt: c.archivedAt?.toISOString() ?? null,
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        accountId: t.accountId,
        toAccountId: t.toAccountId,
        amount: decimalToNumber(t.amount),
        date: toDateKey(t.date),
        categoryId: t.categoryId,
        merchant: t.merchant,
        note: t.note,
        source: t.source,
        rawText: t.rawText,
        createdAt: t.createdAt.toISOString(),
      })),
      keywords: keywords.map((k) => ({
        keyword: k.keyword,
        categoryId: k.categoryId,
        accountId: k.accountId,
      })),
      shortcuts: shortcuts.map((s) => ({
        label: s.label,
        icon: s.icon,
        type: s.type,
        amount: decimalToNumber(s.amount),
        accountId: s.accountId,
        categoryId: s.categoryId,
        merchant: s.merchant,
        sortOrder: s.sortOrder,
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

  /** Movimientos en CSV: ingresos, gastos, transferencias, ajustes y cuotas (pagadas y pendientes). */
  async exportCsv(userId: string): Promise<string> {
    const data = await this.exportJson(userId);
    const today = localTodayKey();
    const accountName = new Map(
      data.accounts.map((a) => [
        a.id,
        a.archivedAt ? `${a.name} (archivada)` : a.name,
      ]),
    );
    const byId = new Map(data.categories.map((c) => [c.id, c]));
    const categoryName = (id: string | null) => {
      const c = id ? byId.get(id) : undefined;
      if (!c) return '';
      const parent = c.parentId ? byId.get(c.parentId) : undefined;
      return parent ? `${parent.name} › ${c.name}` : c.name;
    };
    const rows: { date: string; cells: (string | number | null)[] }[] = [];
    for (const t of data.transactions) {
      const category = categoryName(t.categoryId);
      const title = t.note || t.merchant || category || TX_TYPE_LABEL[t.type];
      const signed =
        t.type === FinanceTxType.INCOME || t.type === FinanceTxType.ADJUSTMENT
          ? t.amount
          : t.type === FinanceTxType.EXPENSE
            ? -t.amount
            : t.amount;
      rows.push({
        date: t.date,
        cells: [
          t.date,
          TX_TYPE_LABEL[t.type],
          title,
          category,
          accountName.get(t.accountId) ?? '',
          t.toAccountId ? (accountName.get(t.toAccountId) ?? '') : '',
          signed,
          '',
          '',
        ],
      });
    }
    for (const c of data.credits) {
      const n = c.installments.length;
      c.installments.forEach((i, k) => {
        const label = `Cuota ${k + 1} de ${n}`;
        if (i.status === InstallmentStatus.PAID) {
          const date = i.paidDate ?? i.dueDate;
          rows.push({
            date,
            cells: [
              date,
              'cuota pagada',
              label,
              '',
              accountName.get(i.paidAccountId ?? c.accountId) ?? '',
              '',
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
              '',
              accountName.get(c.accountId) ?? '',
              '',
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
      [
        'fecha',
        'tipo',
        'descripción',
        'categoría',
        'cuenta',
        'cuenta destino',
        'monto',
        'crédito',
        'estado',
      ],
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
      typeof body.version !== 'number' ||
      !ACCEPTED_VERSIONS.includes(body.version)
    ) {
      throw new BadRequestException(
        'Este archivo no es un respaldo de FerFinance.',
      );
    }
    const report: FinanceImportReport = {
      accounts: 0,
      categories: 0,
      transactions: 0,
      incomes: 0,
      keywords: 0,
      shortcuts: 0,
      credits: 0,
      installments: 0,
    };

    const accountMap = await this.importAccounts(userId, body.accounts, report);
    const categoryMap = await this.importCategories(
      userId,
      body.categories,
      report,
    );
    await this.importTransactions(
      userId,
      body,
      accountMap,
      categoryMap,
      report,
    );
    await this.importKeywords(
      userId,
      body.keywords,
      accountMap,
      categoryMap,
      report,
    );
    await this.importShortcuts(
      userId,
      body.shortcuts,
      accountMap,
      categoryMap,
      report,
    );
    await this.importCredits(userId, body.credits, accountMap, report);
    return report;
  }

  /** Cuentas: la misma si coincide el id (tuyo) o el nombre. */
  private async importAccounts(
    userId: string,
    value: unknown,
    report: FinanceImportReport,
  ) {
    const mine = await this.prisma.financeAccount.findMany({
      where: { userId },
    });
    const byId = new Map(mine.map((a) => [a.id, a.id]));
    const byName = new Map(mine.map((a) => [normTitle(a.name), a.id]));
    const accountMap = new Map<string, string>();
    for (const r of list(value).filter(isObj)) {
      const srcId = str(r.id);
      const name = cleanText(r.name, 120);
      if (!srcId || !name) continue;
      const found = byId.get(srcId) ?? byName.get(normTitle(name));
      if (found) {
        accountMap.set(srcId, found);
        continue;
      }
      const reconciledAt = validDateKey(r.reconciledAt, MAX_DATE);
      const reconciledBalance = signedMoney(r.reconciledBalance);
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
          kind: oneOf(
            r.kind,
            Object.values(FinanceAccountKind),
            FinanceAccountKind.OTHER,
          ),
          institution: cleanText(r.institution, 60),
          last4:
            typeof r.last4 === 'string' && /^\d{4}$/.test(r.last4)
              ? r.last4
              : null,
          currency:
            typeof r.currency === 'string' && /^[A-Z]{3}$/.test(r.currency)
              ? r.currency
              : 'COP',
          color:
            typeof r.color === 'string' && HEX.test(r.color)
              ? r.color
              : '#D4AF37',
          openingBalance: signedMoney(r.openingBalance) ?? 0,
          reconciledAt:
            reconciledAt && reconciledBalance !== null
              ? parseDateKey(reconciledAt)
              : null,
          reconciledBalance:
            reconciledAt && reconciledBalance !== null
              ? reconciledBalance
              : null,
          reconciledMoment:
            reconciledAt && reconciledBalance !== null
              ? instant(r.reconciledMoment)
              : null,
          archivedAt: instant(r.archivedAt),
        },
      });
      accountMap.set(srcId, created.id);
      byName.set(normTitle(name), created.id);
      report.accounts++;
    }
    return accountMap;
  }

  /** Categorías: las de FerFinance por su clave; las tuyas por tipo, principal y nombre. */
  private async importCategories(
    userId: string,
    value: unknown,
    report: FinanceImportReport,
  ) {
    const categoryMap = new Map<string, string>();
    const rows = list(value).filter(isObj);
    if (!rows.length) return categoryMap;
    await this.categories.ensureSeeded(userId);
    const mine = await this.prisma.financeCategory.findMany({
      where: { userId },
    });
    const byId = new Set(mine.map((c) => c.id));
    const bySystem = new Map(
      mine.filter((c) => c.systemKey).map((c) => [c.systemKey as string, c.id]),
    );
    const keyOf = (kind: string, parentId: string | null, name: string) =>
      `${kind}|${parentId ?? ''}|${normalizeKeyword(name)}`;
    const byName = new Map(
      mine.map((c) => [keyOf(c.kind, c.parentId, c.name), c.id]),
    );
    // Primero las principales, después las subcategorías (necesitan la principal).
    const ordered = [
      ...rows.filter((r) => !r.parentId),
      ...rows.filter((r) => r.parentId),
    ];
    for (const r of ordered) {
      const srcId = str(r.id);
      const name = cleanText(r.name, 60);
      if (!srcId || !name) continue;
      const kind = oneOf(
        r.kind,
        [FinanceCategoryKind.EXPENSE, FinanceCategoryKind.INCOME],
        FinanceCategoryKind.EXPENSE,
      );
      const systemKey = str(r.systemKey);
      const srcParent = str(r.parentId);
      const parentId = srcParent ? (categoryMap.get(srcParent) ?? null) : null;
      if (srcParent && !parentId) continue;
      const found =
        (byId.has(srcId) ? srcId : undefined) ??
        (systemKey ? bySystem.get(systemKey) : undefined) ??
        byName.get(keyOf(kind, parentId, name));
      if (found) {
        categoryMap.set(srcId, found);
        continue;
      }
      const created = await this.prisma.financeCategory.create({
        data: {
          userId,
          kind,
          parentId,
          name,
          icon: cleanText(r.icon, 16),
          color:
            typeof r.color === 'string' && HEX.test(r.color) ? r.color : null,
          sortOrder:
            typeof r.sortOrder === 'number' ? Math.trunc(r.sortOrder) : 0,
          archivedAt: instant(r.archivedAt),
        },
      });
      categoryMap.set(srcId, created.id);
      byName.set(keyOf(kind, parentId, name), created.id);
      report.categories++;
    }
    return categoryMap;
  }

  /** Movimientos (y los ingresos de un respaldo viejo): ya está si coinciden tipo, cuentas, día, monto y nota. */
  private async importTransactions(
    userId: string,
    body: Obj,
    accountMap: Map<string, string>,
    categoryMap: Map<string, string>,
    report: FinanceImportReport,
  ) {
    const existing = await this.prisma.financeTransaction.findMany({
      where: { userId },
      select: {
        type: true,
        accountId: true,
        toAccountId: true,
        date: true,
        amount: true,
        note: true,
      },
    });
    const keyOf = (
      type: string,
      accountId: string,
      toAccountId: string | null,
      date: string,
      amount: number,
      note: string | null,
    ) =>
      `${type}|${accountId}|${toAccountId ?? ''}|${date}|${Math.round(amount)}|${note ?? ''}`;
    const seen = new Set(
      existing.map((e) =>
        keyOf(
          e.type,
          e.accountId,
          e.toAccountId,
          toDateKey(e.date),
          decimalToNumber(e.amount),
          e.note,
        ),
      ),
    );
    const data: Prisma.FinanceTransactionCreateManyInput[] = [];

    for (const r of list(body.transactions).filter(isObj)) {
      const type = oneOf(r.type, TX_TYPES, FinanceTxType.EXPENSE);
      if (r.type !== type) continue;
      const accountId = str(r.accountId)
        ? accountMap.get(r.accountId as string)
        : undefined;
      const toAccountId =
        type === FinanceTxType.TRANSFER && str(r.toAccountId)
          ? accountMap.get(r.toAccountId as string)
          : undefined;
      const date = validDateKey(r.date, MAX_DATE);
      const amount =
        type === FinanceTxType.ADJUSTMENT
          ? signedMoney(r.amount)
          : money(r.amount);
      if (!accountId || !date || amount === null || amount === 0) continue;
      if (
        type === FinanceTxType.TRANSFER &&
        (!toAccountId || toAccountId === accountId)
      )
        continue;
      const note = cleanText(r.note, 300);
      const k = keyOf(type, accountId, toAccountId ?? null, date, amount, note);
      if (seen.has(k)) continue;
      seen.add(k);
      const categoryId =
        (type === FinanceTxType.INCOME || type === FinanceTxType.EXPENSE) &&
        str(r.categoryId)
          ? (categoryMap.get(r.categoryId as string) ?? null)
          : null;
      data.push({
        userId,
        type,
        accountId,
        toAccountId: toAccountId ?? null,
        amount,
        date: parseDateKey(date),
        categoryId,
        merchant: cleanText(r.merchant, 120),
        note,
        source: oneOf(
          r.source,
          Object.values(FinanceTxSource),
          FinanceTxSource.IMPORT,
        ),
        rawText: cleanText(r.rawText, 500),
        createdAt: instant(r.createdAt) ?? undefined,
      });
      report.transactions++;
    }

    // Respaldo de la versión 1: los ingresos entran como movimientos.
    for (const r of list(body.incomes).filter(isObj)) {
      const accountId = str(r.accountId)
        ? accountMap.get(r.accountId as string)
        : undefined;
      const date = validDateKey(r.date, MAX_DATE);
      const amount = money(r.amount);
      if (!accountId || !date || amount === null) continue;
      const note = cleanText(r.description, 200);
      const k = keyOf(
        FinanceTxType.INCOME,
        accountId,
        null,
        date,
        amount,
        note,
      );
      if (seen.has(k)) continue;
      seen.add(k);
      data.push({
        userId,
        type: FinanceTxType.INCOME,
        accountId,
        amount,
        date: parseDateKey(date),
        note,
        source: FinanceTxSource.IMPORT,
        createdAt: instant(r.createdAt) ?? undefined,
      });
      report.incomes++;
    }
    for (let k = 0; k < data.length; k += 1000)
      await this.prisma.financeTransaction.createMany({
        data: data.slice(k, k + 1000),
      });
  }

  private async importKeywords(
    userId: string,
    value: unknown,
    accountMap: Map<string, string>,
    categoryMap: Map<string, string>,
    report: FinanceImportReport,
  ) {
    const rows = list(value).filter(isObj);
    if (!rows.length) return;
    const have = new Set(
      (
        await this.prisma.financeKeyword.findMany({
          where: { userId },
          select: { keyword: true },
        })
      ).map((k) => k.keyword),
    );
    for (const r of rows) {
      const keyword =
        typeof r.keyword === 'string'
          ? normalizeKeyword(r.keyword).slice(0, 60)
          : '';
      const categoryId = str(r.categoryId)
        ? categoryMap.get(r.categoryId as string)
        : undefined;
      const accountId = str(r.accountId)
        ? accountMap.get(r.accountId as string)
        : undefined;
      if (!keyword || have.has(keyword) || (!categoryId && !accountId))
        continue;
      await this.prisma.financeKeyword.create({
        data: {
          userId,
          keyword,
          categoryId: categoryId ?? null,
          accountId: categoryId ? null : (accountId ?? null),
        },
      });
      have.add(keyword);
      report.keywords++;
    }
  }

  private async importShortcuts(
    userId: string,
    value: unknown,
    accountMap: Map<string, string>,
    categoryMap: Map<string, string>,
    report: FinanceImportReport,
  ) {
    const rows = list(value).filter(isObj);
    if (!rows.length) return;
    const mine = await this.prisma.financeShortcut.findMany({
      where: { userId },
    });
    const keyOf = (label: string, amount: number, accountId: string) =>
      `${normalizeKeyword(label)}|${Math.round(amount)}|${accountId}`;
    const have = new Set(
      mine.map((s) => keyOf(s.label, decimalToNumber(s.amount), s.accountId)),
    );
    let count = mine.length;
    for (const r of rows) {
      if (count >= 24) break;
      const label = cleanText(r.label, 40);
      const amount = money(r.amount);
      const accountId = str(r.accountId)
        ? accountMap.get(r.accountId as string)
        : undefined;
      if (!label || amount === null || !accountId) continue;
      const k = keyOf(label, amount, accountId);
      if (have.has(k)) continue;
      await this.prisma.financeShortcut.create({
        data: {
          userId,
          label,
          icon: cleanText(r.icon, 16),
          type: oneOf(
            r.type,
            [FinanceTxType.EXPENSE, FinanceTxType.INCOME],
            FinanceTxType.EXPENSE,
          ),
          amount: roundPesos(amount),
          accountId,
          categoryId: str(r.categoryId)
            ? (categoryMap.get(r.categoryId as string) ?? null)
            : null,
          merchant: cleanText(r.merchant, 120),
          sortOrder: count,
        },
      });
      have.add(k);
      count++;
      report.shortcuts++;
    }
  }

  /**
   * Créditos: el mismo si coincide el id (tuyo) o el nombre en la misma cuenta. De uno que ya existe solo se
   * suman las cuotas que falten (mismo día y valor).
   */
  private async importCredits(
    userId: string,
    value: unknown,
    accountMap: Map<string, string>,
    report: FinanceImportReport,
  ) {
    const credits = await this.prisma.credit.findMany({
      where: { userId },
      include: { installments: { select: { dueDate: true, amount: true } } },
    });
    const creditById = new Map(credits.map((c) => [c.id, c]));
    const creditByName = new Map(
      credits.map((c) => [`${c.accountId}|${normTitle(c.name)}`, c]),
    );
    for (const r of list(value).filter(isObj)) {
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
