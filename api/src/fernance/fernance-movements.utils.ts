/**
 * Movimientos de FerFinance como se muestran: los de FinanceTransaction (ingresos, gastos, transferencias y ajustes)
 * y las cuotas pagadas de los créditos, en una sola lista. El efecto de cada uno depende de lo que se mira: una
 * transferencia de Bancolombia a Nequi suma en Nequi, resta en Bancolombia y no mueve nada si se miran las dos.
 */

export type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ADJUSTMENT';
export type MovementType = TxType | 'INSTALLMENT';

export type MovementItem = {
  id: string;
  kind: 'tx' | 'installment';
  type: MovementType;
  date: string;
  /** Positivo, salvo en los ajustes (negativo = el saldo bajó). */
  amount: number;
  /** Lo que le hizo a lo que se mira: + entró, − salió, 0 se movió entre tus cuentas. */
  effect: number;
  title: string;
  accountId: string;
  accountName: string;
  accountColor: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  merchant: string | null;
  note: string | null;
  source: string | null;
  needsReview: boolean;
  creditId: string | null;
  creditName: string | null;
  createdAt: string | null;
};

export type MovementTx = {
  id: string;
  type: TxType;
  dateKey: string;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  note: string | null;
  source: string | null;
  needsReview: boolean;
  createdAt: string | null;
};

export type MovementInstallment = {
  id: string;
  creditId: string;
  creditName: string;
  dateKey: string;
  amount: number;
  /** De donde salió el pago. */
  accountId: string;
};

export type MovementLookups = {
  accounts: Map<string, { name: string; color: string | null }>;
  categories: Map<string, { name: string; icon: string | null }>;
};

export type MovementTotals = {
  income: number;
  expense: number;
  installments: number;
  transfersIn: number;
  transfersOut: number;
  adjustments: number;
  net: number;
  count: number;
};

const add = (a: number, b: number) => Math.round((a + b) * 100) / 100;

export const TYPE_LABELS: Record<MovementType, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
  TRANSFER: 'Transferencia',
  ADJUSTMENT: 'Ajuste de saldo',
  INSTALLMENT: 'Cuota',
};

/** Lo que un movimiento le hace a un grupo de cuentas (una cuenta, un libro o todas). */
export function effectOn(
  type: MovementType,
  accountId: string,
  toAccountId: string | null,
  amount: number,
  scope: Set<string>,
): number {
  const inScope = (id: string | null) => id !== null && scope.has(id);
  switch (type) {
    case 'INCOME':
    case 'ADJUSTMENT':
      return inScope(accountId) ? amount : 0;
    case 'EXPENSE':
    case 'INSTALLMENT':
      return inScope(accountId) ? -amount : 0;
    case 'TRANSFER':
      return add(
        inScope(toAccountId) ? amount : 0,
        inScope(accountId) ? -amount : 0,
      );
  }
}

export function txToItem(
  tx: MovementTx,
  lookups: MovementLookups,
  scope: Set<string>,
): MovementItem {
  const account = lookups.accounts.get(tx.accountId);
  const to = tx.toAccountId ? lookups.accounts.get(tx.toAccountId) : undefined;
  const category = tx.categoryId
    ? lookups.categories.get(tx.categoryId)
    : undefined;
  return {
    id: tx.id,
    kind: 'tx',
    type: tx.type,
    date: tx.dateKey,
    amount: tx.amount,
    effect: effectOn(tx.type, tx.accountId, tx.toAccountId, tx.amount, scope),
    title: tx.note || tx.merchant || category?.name || TYPE_LABELS[tx.type],
    accountId: tx.accountId,
    accountName: account?.name ?? 'Cuenta',
    accountColor: account?.color ?? null,
    toAccountId: tx.toAccountId,
    toAccountName: tx.toAccountId ? (to?.name ?? 'Cuenta') : null,
    categoryId: category ? tx.categoryId : null,
    categoryName: category?.name ?? null,
    categoryIcon: category?.icon ?? null,
    merchant: tx.merchant,
    note: tx.note,
    source: tx.source,
    needsReview: tx.needsReview,
    creditId: null,
    creditName: null,
    createdAt: tx.createdAt,
  };
}

export function installmentToItem(
  inst: MovementInstallment,
  lookups: MovementLookups,
  scope: Set<string>,
): MovementItem {
  const account = lookups.accounts.get(inst.accountId);
  return {
    id: inst.id,
    kind: 'installment',
    type: 'INSTALLMENT',
    date: inst.dateKey,
    amount: inst.amount,
    effect: effectOn('INSTALLMENT', inst.accountId, null, inst.amount, scope),
    title: `Cuota: ${inst.creditName}`,
    accountId: inst.accountId,
    accountName: account?.name ?? 'Cuenta',
    accountColor: account?.color ?? null,
    toAccountId: null,
    toAccountName: null,
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    merchant: null,
    note: null,
    source: null,
    needsReview: false,
    creditId: inst.creditId,
    creditName: inst.creditName,
    createdAt: null,
  };
}

/** Lo más reciente primero; el mismo día, lo último que se anotó primero. */
export function sortMovements(items: MovementItem[]): MovementItem[] {
  return [...items].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '') ||
      b.id.localeCompare(a.id),
  );
}

export function movementTotals(items: MovementItem[]): MovementTotals {
  const t: MovementTotals = {
    income: 0,
    expense: 0,
    installments: 0,
    transfersIn: 0,
    transfersOut: 0,
    adjustments: 0,
    net: 0,
    count: items.length,
  };
  for (const m of items) {
    t.net = add(t.net, m.effect);
    if (m.effect === 0) continue;
    if (m.type === 'INCOME') t.income = add(t.income, m.amount);
    else if (m.type === 'EXPENSE') t.expense = add(t.expense, m.amount);
    else if (m.type === 'INSTALLMENT')
      t.installments = add(t.installments, m.amount);
    else if (m.type === 'ADJUSTMENT')
      t.adjustments = add(t.adjustments, m.effect);
    else if (m.effect > 0) t.transfersIn = add(t.transfersIn, m.effect);
    else t.transfersOut = add(t.transfersOut, -m.effect);
  }
  return t;
}

/** Saldo de cada cuenta: lo inicial, más lo que entró, menos lo que salió (también las cuotas pagadas desde ella). */
export function combineBalances(
  openings: { id: string; openingBalance: number }[],
  sums: { accountId: string; type: TxType; sum: number }[],
  transfersIn: { accountId: string; sum: number }[],
  installmentsPaid: { accountId: string; amount: number }[],
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const a of openings) balances.set(a.id, a.openingBalance);
  const move = (id: string, delta: number) => {
    if (balances.has(id)) balances.set(id, add(balances.get(id) ?? 0, delta));
  };
  for (const s of sums) {
    if (s.type === 'INCOME' || s.type === 'ADJUSTMENT')
      move(s.accountId, s.sum);
    else move(s.accountId, -s.sum);
  }
  for (const t of transfersIn) move(t.accountId, t.sum);
  for (const i of installmentsPaid) move(i.accountId, -i.amount);
  return balances;
}
