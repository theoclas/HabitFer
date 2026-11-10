import { daysBetween, isDateInRange } from './fernance.utils';
import {
  installmentToItem,
  movementTotals,
  sortMovements,
  txToItem,
  type MovementItem,
  type MovementLookups,
  type MovementTx,
} from './fernance-movements.utils';

export type SummaryInstallment = {
  id: string;
  dueKey: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'SKIPPED';
  /** Día real del pago (o el día en que se marcó, en pagos viejos). */
  paidKey: string | null;
  /** Valor pagado de verdad; null = el de la cuota. */
  paidAmount: number | null;
  /** Cuenta de donde salió; null = la del crédito. */
  paidAccountId: string | null;
};

export type SummaryCredit = {
  id: string;
  name: string;
  accountId: string;
  status: 'ACTIVE' | 'PAID_OFF' | 'CANCELLED';
  installments: SummaryInstallment[];
};

/** Movimientos de la lista vieja del resumen (se conserva para las apps que aún no se actualizan). */
export type Movement = {
  id: string;
  type:
    | 'income'
    | 'installment_paid'
    | 'installment_pending'
    | 'installment_overdue';
  date: string;
  amount: number;
  label: string;
  accountId: string;
  accountName: string;
  creditId?: string;
  creditName?: string;
  installmentId?: string;
  status?: string;
  daysLate?: number;
};

export type DueItem = {
  id: string;
  creditId: string;
  creditName: string;
  accountId: string;
  accountName: string;
  dueDate: string;
  amount: number;
  /** Días de atraso (solo en las vencidas). */
  daysLate?: number;
};

export type ProjectionMonth = {
  month: string;
  label: string;
  total: number;
  installments: {
    id: string;
    creditId: string;
    creditName: string;
    dueDate: string;
    amount: number;
  }[];
};

export type SummaryInput = {
  range: { from: string; to: string };
  todayKey: string;
  /** Las cuentas que se miran: una, las de un libro o todas las activas. */
  scope: Set<string>;
  /** La cuenta del filtro (null si se mira un libro o todo). */
  accountId: string | null;
  /** El libro del filtro (null si se mira una cuenta o todo). */
  book: string | null;
  /** Los movimientos del periodo (ya filtrados por fecha). */
  transactions: MovementTx[];
  credits: SummaryCredit[];
  lookups: MovementLookups;
};

const UPCOMING_LIMIT = 6;
const RECENT_LIMIT = 8;
const add = (a: number, b: number) => Math.round((a + b) * 100) / 100;

/**
 * Resumen de un periodo. Reglas:
 * - Ingresos, gastos y ajustes cuentan en su cuenta; una transferencia solo cuenta si cruza el borde de lo que se
 *   mira (de un libro a otro, por ejemplo).
 * - Lo pagado de los créditos cuenta el día real del pago, por el valor que se pagó y en la cuenta de donde salió.
 * - Lo pendiente del periodo es «comprometido». Si el periodo incluye hoy, las vencidas de antes también.
 * - Las vencidas (pendientes con fecha anterior a hoy) salen siempre en su propia lista, sin importar el periodo.
 * - Los créditos cancelados no comprometen nada: sus cuotas pendientes no cuentan.
 */
export function buildSummary(input: SummaryInput) {
  const { range, todayKey, scope, lookups } = input;
  const includesToday = isDateInRange(todayKey, range.from, range.to);
  const nameOf = (id: string) => lookups.accounts.get(id)?.name ?? 'Cuenta';

  let committed = 0;
  let overdueTotal = 0;
  const legacy: Movement[] = [];
  const items: MovementItem[] = [];
  const overdue: DueItem[] = [];
  const upcoming: DueItem[] = [];
  const projection = new Map<string, ProjectionMonth>();

  for (const tx of input.transactions) {
    if (!isDateInRange(tx.dateKey, range.from, range.to)) continue;
    if (
      !scope.has(tx.accountId) &&
      !(tx.toAccountId && scope.has(tx.toAccountId))
    )
      continue;
    const item = txToItem(tx, lookups, scope);
    items.push(item);
    if (tx.type === 'INCOME') {
      legacy.push({
        id: tx.id,
        type: 'income',
        date: tx.dateKey,
        amount: tx.amount,
        label: item.title,
        accountId: tx.accountId,
        accountName: item.accountName,
      });
    }
  }

  for (const credit of input.credits) {
    for (const inst of credit.installments) {
      if (inst.status === 'PAID') {
        const payAccount = inst.paidAccountId ?? credit.accountId;
        if (!scope.has(payAccount)) continue;
        const key = inst.paidKey ?? inst.dueKey;
        if (!isDateInRange(key, range.from, range.to)) continue;
        const amount = inst.paidAmount ?? inst.amount;
        items.push(
          installmentToItem(
            {
              id: inst.id,
              creditId: credit.id,
              creditName: credit.name,
              dateKey: key,
              amount,
              accountId: payAccount,
            },
            lookups,
            scope,
          ),
        );
        legacy.push({
          id: inst.id,
          type: 'installment_paid',
          date: key,
          amount: -amount,
          label: `Cuota: ${credit.name}`,
          accountId: payAccount,
          accountName: nameOf(payAccount),
          creditId: credit.id,
          creditName: credit.name,
          installmentId: inst.id,
          status: 'PAID',
        });
        continue;
      }
      if (inst.status !== 'PENDING' || credit.status === 'CANCELLED') continue;
      if (!scope.has(credit.accountId)) continue;

      const item: DueItem = {
        id: inst.id,
        creditId: credit.id,
        creditName: credit.name,
        accountId: credit.accountId,
        accountName: nameOf(credit.accountId),
        dueDate: inst.dueKey,
        amount: inst.amount,
      };
      const late = inst.dueKey < todayKey;
      if (late) {
        const daysLate = daysBetween(inst.dueKey, todayKey);
        overdue.push({ ...item, daysLate });
        overdueTotal = add(overdueTotal, inst.amount);
      } else {
        upcoming.push(item);
      }

      const inRange = isDateInRange(inst.dueKey, range.from, range.to);
      const carriedOver = late && includesToday && inst.dueKey < range.from;
      if (inRange || carriedOver) {
        committed = add(committed, inst.amount);
        legacy.push({
          id: inst.id,
          type: late ? 'installment_overdue' : 'installment_pending',
          date: inst.dueKey,
          amount: -inst.amount,
          label: late
            ? `Cuota vencida: ${credit.name}`
            : `Cuota pendiente: ${credit.name}`,
          accountId: credit.accountId,
          accountName: nameOf(credit.accountId),
          creditId: credit.id,
          creditName: credit.name,
          installmentId: inst.id,
          status: 'PENDING',
          ...(late ? { daysLate: daysBetween(inst.dueKey, todayKey) } : {}),
        });
      } else if (inst.dueKey > range.to) {
        const month = inst.dueKey.slice(0, 7);
        const bucket = projection.get(month) ?? {
          month,
          label: month,
          total: 0,
          installments: [],
        };
        bucket.total = add(bucket.total, inst.amount);
        bucket.installments.push({
          id: inst.id,
          creditId: credit.id,
          creditName: credit.name,
          dueDate: inst.dueKey,
          amount: inst.amount,
        });
        projection.set(month, bucket);
      }
    }
  }

  legacy.sort(
    (a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type),
  );
  overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const sorted = sortMovements(items);
  const flows = movementTotals(sorted);

  return {
    from: range.from,
    to: range.to,
    accountId: input.accountId,
    book: input.book,
    today: todayKey,
    totals: {
      income: flows.income,
      expense: flows.expense,
      paidInstallments: flows.installments,
      transfersIn: flows.transfersIn,
      transfersOut: flows.transfersOut,
      adjustments: flows.adjustments,
      /** Lo que quedó del periodo: entró menos salió. */
      net: flows.net,
      /** Igual a `net` (nombre de antes). */
      available: flows.net,
      committed,
      overdue: overdueTotal,
    },
    /** Lo último del periodo (todos los tipos). */
    recent: sorted.slice(0, RECENT_LIMIT),
    movementCount: sorted.length,
    /** Lista de antes: ingresos y cuotas. */
    movements: legacy,
    overdue,
    upcoming: upcoming.slice(0, UPCOMING_LIMIT),
    projection: [...projection.values()].sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
  };
}

export type FinanceSummary = ReturnType<typeof buildSummary>;
