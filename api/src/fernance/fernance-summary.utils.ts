import { daysBetween, isDateInRange } from './fernance.utils';

export type SummaryIncome = {
  id: string;
  dateKey: string;
  amount: number;
  label: string;
  accountId: string;
  accountName: string;
};

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
  /** Filtro por cuenta; null = todas. */
  accountId: string | null;
  incomes: SummaryIncome[];
  credits: SummaryCredit[];
  accountNames: Map<string, string>;
};

const UPCOMING_LIMIT = 6;
const add = (a: number, b: number) => Math.round((a + b) * 100) / 100;

/**
 * Resumen de un periodo. Reglas:
 * - Lo pagado cuenta el día real del pago, por el valor que se pagó y en la cuenta de donde salió.
 * - Lo pendiente del periodo es «comprometido». Si el periodo incluye hoy, las vencidas de antes también.
 * - Las vencidas (pendientes con fecha anterior a hoy) salen siempre en su propia lista, sin importar el periodo.
 * - Los créditos cancelados no comprometen nada: sus cuotas pendientes no cuentan.
 */
export function buildSummary(input: SummaryInput) {
  const { range, todayKey, accountId, accountNames } = input;
  const includesToday = isDateInRange(todayKey, range.from, range.to);
  const nameOf = (id: string) => accountNames.get(id) ?? 'Cuenta';

  let income = 0;
  let paid = 0;
  let committed = 0;
  let overdueTotal = 0;
  const movements: Movement[] = [];
  const overdue: DueItem[] = [];
  const upcoming: DueItem[] = [];
  const projection = new Map<string, ProjectionMonth>();

  for (const inc of input.incomes) {
    if (accountId && inc.accountId !== accountId) continue;
    if (!isDateInRange(inc.dateKey, range.from, range.to)) continue;
    income = add(income, inc.amount);
    movements.push({
      id: inc.id,
      type: 'income',
      date: inc.dateKey,
      amount: inc.amount,
      label: inc.label,
      accountId: inc.accountId,
      accountName: inc.accountName,
    });
  }

  for (const credit of input.credits) {
    for (const inst of credit.installments) {
      if (inst.status === 'PAID') {
        const payAccount = inst.paidAccountId ?? credit.accountId;
        if (accountId && payAccount !== accountId) continue;
        const key = inst.paidKey ?? inst.dueKey;
        if (!isDateInRange(key, range.from, range.to)) continue;
        const amount = inst.paidAmount ?? inst.amount;
        paid = add(paid, amount);
        movements.push({
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
      if (accountId && credit.accountId !== accountId) continue;

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
        movements.push({
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

  movements.sort(
    (a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type),
  );
  overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    from: range.from,
    to: range.to,
    accountId,
    today: todayKey,
    totals: {
      income,
      paidInstallments: paid,
      available: add(income, -paid),
      committed,
      overdue: overdueTotal,
    },
    movements,
    overdue,
    upcoming: upcoming.slice(0, UPCOMING_LIMIT),
    projection: [...projection.values()].sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
  };
}

export type FinanceSummary = ReturnType<typeof buildSummary>;
