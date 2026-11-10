/** El libro de una cuenta (Personal, Negocio u Otro): dos libros separados. */
export type FinanceAccountType = "PERSONAL" | "BUSINESS" | "OTHER";
export type FinanceAccountKind = "SAVINGS" | "CHECKING" | "CASH" | "WALLET" | "CREDIT_CARD" | "INVESTMENT" | "OTHER";
export type CreditStatus = "ACTIVE" | "PAID_OFF" | "CANCELLED";
export type InstallmentStatus = "PENDING" | "PAID" | "SKIPPED";
export type CategoryKind = "EXPENSE" | "INCOME";
export type TxType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
export type MovementType = TxType | "INSTALLMENT";
/** Lo que se anota a mano (los ajustes salen de «Cuadrar»). */
export type EntryType = "EXPENSE" | "INCOME" | "TRANSFER";

export type FinanceAccount = {
  id: string;
  userId: string;
  name: string;
  /** El libro. */
  type: FinanceAccountType;
  kind: FinanceAccountKind;
  institution: string | null;
  last4: string | null;
  currency: string;
  color: string | null;
  openingBalance: number;
  /** Último cuadre con el banco (AAAA-MM-DD). */
  reconciledAt: string | null;
  reconciledBalance: number | null;
  /** Momento del cuadre (si fue con el saldo de ese mismo día). */
  reconciledMoment: string | null;
  /** Algo de lo ya cuadrado cambió: ya no cuadra. */
  reconcileStale: boolean;
  /** Saldo de hoy (en una tarjeta, negativo = lo que debes). */
  balance: number | null;
  createdAt: string;
  updatedAt: string;
  /** null = activa; con fecha = en la papelera. */
  archivedAt: string | null;
};

export type FinanceCategory = {
  id: string;
  kind: CategoryKind;
  parentId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  systemKey: string | null;
  sortOrder: number;
  archivedAt: string | null;
  /** Veces que se usó en los últimos 90 días. */
  uses: number;
};

export type MovementItem = {
  id: string;
  kind: "tx" | "installment";
  type: MovementType;
  date: string;
  /** Positivo, salvo en los ajustes. */
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

export type MovementsResponse = {
  items: MovementItem[];
  totals: MovementTotals;
  truncated: boolean;
  /** «Revisado hasta aquí» de la cuenta filtrada (con el momento, si fue con el saldo de ese día). */
  reconciled: { date: string; balance: number; stale: boolean; moment: string | null } | null;
};

export type MovementsQuery = {
  from?: string;
  to?: string;
  accountId?: string;
  book?: FinanceAccountType;
  type?: MovementType;
  categoryId?: string;
  q?: string;
  min?: number;
  max?: number;
  limit?: number;
};

export type CreditInstallment = {
  id: string;
  creditId: string;
  dueDate: string;
  amount: number;
  status: InstallmentStatus;
  paidAt: string | null;
  /** Día real del pago (AAAA-MM-DD). */
  paidDate: string | null;
  /** Lo que se pagó de verdad; null = el valor de la cuota. */
  paidAmount: number | null;
  /** Cuenta de donde salió; null = la del crédito. */
  paidAccountId: string | null;
};

export type Credit = {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  totalAmount: number;
  installmentAmount: number;
  status: CreditStatus;
  createdAt: string;
  updatedAt: string;
  account: { id: string; name: string; color: string | null; archived: boolean };
  installments: CreditInstallment[];
  paidCount: number;
  paidTotal: number;
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  overdueTotal: number;
  nextDue: { id: string; dueDate: string; amount: number; daysLate: number } | null;
};

export type DueItem = {
  id: string;
  creditId: string;
  creditName: string;
  accountId: string;
  accountName: string;
  dueDate: string;
  amount: number;
  daysLate?: number;
};

export type FinanceProjectionMonth = {
  month: string;
  label: string;
  total: number;
  installments: { id: string; creditId: string; creditName: string; dueDate: string; amount: number }[];
};

export type AccountBalance = {
  id: string;
  name: string;
  type: FinanceAccountType;
  kind: FinanceAccountKind;
  color: string | null;
  institution: string | null;
  balance: number;
  reconciledAt: string | null;
};

export type FinanceSummary = {
  from: string;
  to: string;
  accountId: string | null;
  book: FinanceAccountType | null;
  today: string;
  totals: {
    income: number;
    expense: number;
    paidInstallments: number;
    transfersIn: number;
    transfersOut: number;
    adjustments: number;
    net: number;
    available: number;
    committed: number;
    overdue: number;
  };
  recent: MovementItem[];
  movementCount: number;
  overdue: DueItem[];
  upcoming: DueItem[];
  projection: FinanceProjectionMonth[];
  balances: { total: number; accounts: AccountBalance[] };
};

export type ParseResult = {
  type: EntryType;
  amount: number | null;
  assumedThousands: boolean;
  date: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  note: string | null;
  unknown: string[];
  hints: string[];
};

export type FinanceKeyword = {
  id: string;
  keyword: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  accountId: string | null;
  accountName: string | null;
};

export type FinanceShortcut = {
  id: string;
  label: string;
  icon: string | null;
  type: "INCOME" | "EXPENSE";
  amount: number;
  accountId: string;
  categoryId: string | null;
  merchant: string | null;
  sortOrder: number;
};

export type ShortcutSuggestion = {
  label: string | null;
  type: "INCOME" | "EXPENSE";
  accountId: string;
  categoryId: string | null;
  amount: number;
  merchant: string | null;
  count: number;
  lastDate: string;
};

export type QuickData = { shortcuts: FinanceShortcut[]; suggestions: ShortcutSuggestion[] };

export type AccountPayload = {
  name: string;
  type?: FinanceAccountType;
  kind?: FinanceAccountKind;
  color?: string;
  institution?: string;
  last4?: string;
  openingBalance?: number;
};
export type TransactionPayload = {
  type: EntryType;
  accountId: string;
  toAccountId?: string;
  amount: number;
  date: string;
  categoryId?: string | null;
  merchant?: string;
  note?: string;
  source?: "MANUAL" | "TEXT" | "SHORTCUT";
  rawText?: string;
};
export type TransactionUpdate = {
  type?: EntryType;
  accountId?: string;
  toAccountId?: string | null;
  amount?: number;
  date?: string;
  categoryId?: string | null;
  merchant?: string;
  note?: string;
};
export type BulkPayload = { ids: string[]; delete?: boolean; categoryId?: string | null; accountId?: string; date?: string };
export type CategoryPayload = { name: string; kind?: CategoryKind; parentId?: string; icon?: string; color?: string };
export type CategoryUpdate = { name?: string; parentId?: string | null; icon?: string; color?: string | null };
export type ShortcutPayload = {
  label: string;
  icon?: string;
  type?: "INCOME" | "EXPENSE";
  amount: number;
  accountId: string;
  categoryId?: string | null;
  merchant?: string;
};
export type CreditPayload = { accountId: string; name: string; totalAmount: number; installmentAmount: number; firstDueDate: string };
export type CreditUpdate = { name?: string; accountId?: string; status?: CreditStatus; installmentAmount?: number };
export type ReplanPayload = { count: number; amount: number; firstDueDate: string; lastAmount?: number };
export type PayPayload = { paidDate?: string; paidAmount?: number; accountId?: string };
export type InstallmentUpdate = { dueDate?: string; amount?: number };
export type ReconcileResult = { account: FinanceAccount; adjustment: number; previousBalance: number };
export type FinanceImportReport = {
  accounts: number;
  categories: number;
  transactions: number;
  incomes: number;
  keywords: number;
  shortcuts: number;
  credits: number;
  installments: number;
};

/** Los libros. */
export const ACCOUNT_TYPE_LABELS: Record<FinanceAccountType, string> = {
  PERSONAL: "Personal",
  BUSINESS: "Negocio",
  OTHER: "Otro",
};

export const ACCOUNT_KIND_LABELS: Record<FinanceAccountKind, string> = {
  SAVINGS: "Ahorros",
  CHECKING: "Corriente",
  CASH: "Efectivo",
  WALLET: "Billetera (Nequi, Daviplata)",
  CREDIT_CARD: "Tarjeta de crédito",
  INVESTMENT: "Inversión",
  OTHER: "General",
};

export const ACCOUNT_KIND_ICONS: Record<FinanceAccountKind, string> = {
  SAVINGS: "🏦",
  CHECKING: "🏛️",
  CASH: "💵",
  WALLET: "📱",
  CREDIT_CARD: "💳",
  INVESTMENT: "📈",
  OTHER: "🗂️",
};

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
  TRANSFER: "Transferencia",
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  INCOME: "Ingresos",
  EXPENSE: "Gastos",
  TRANSFER: "Transferencias",
  ADJUSTMENT: "Ajustes",
  INSTALLMENT: "Cuotas",
};

export const CREDIT_STATUS_LABELS: Record<CreditStatus, string> = {
  ACTIVE: "Activo",
  PAID_OFF: "Pagado",
  CANCELLED: "Cancelado",
};

/** Bancos y billeteras de Colombia, para sugerir al crear una cuenta. */
export const INSTITUTIONS = [
  "Bancolombia",
  "Nequi",
  "Daviplata",
  "Davivienda",
  "Banco de Bogotá",
  "BBVA",
  "Nu",
  "Banco de Occidente",
  "Banco Popular",
  "AV Villas",
  "Scotiabank Colpatria",
  "Banco Caja Social",
  "Itaú",
  "Banco Falabella",
  "Lulo Bank",
  "RappiPay",
  "Movii",
  "Banco Agrario",
  "Banco Pichincha",
  "Banco Finandina",
  "Ualá",
  "Global66",
  "Dale!",
];
