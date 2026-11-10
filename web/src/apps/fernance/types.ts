export type FinanceAccountType = "PERSONAL" | "BUSINESS" | "OTHER";
export type CreditStatus = "ACTIVE" | "PAID_OFF" | "CANCELLED";
export type InstallmentStatus = "PENDING" | "PAID" | "SKIPPED";

export type FinanceAccount = {
  id: string;
  userId: string;
  name: string;
  type: FinanceAccountType;
  currency: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  /** null = activa; con fecha = en la papelera. */
  archivedAt: string | null;
};

export type Income = {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  date: string;
  description: string | null;
  createdAt: string;
  account?: { id: string; name: string; color: string | null };
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

export type MovementType = "income" | "installment_paid" | "installment_pending" | "installment_overdue";

export type FinanceMovement = {
  id: string;
  type: MovementType;
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
  daysLate?: number;
};

export type FinanceProjectionMonth = {
  month: string;
  label: string;
  total: number;
  installments: { id: string; creditId: string; creditName: string; dueDate: string; amount: number }[];
};

export type FinanceSummary = {
  from: string;
  to: string;
  accountId: string | null;
  today: string;
  totals: {
    income: number;
    paidInstallments: number;
    available: number;
    committed: number;
    overdue: number;
  };
  movements: FinanceMovement[];
  overdue: DueItem[];
  upcoming: DueItem[];
  projection: FinanceProjectionMonth[];
};

export type AccountPayload = { name: string; type?: FinanceAccountType; color?: string };
export type IncomePayload = { accountId: string; amount: number; date: string; description?: string };
export type CreditPayload = { accountId: string; name: string; totalAmount: number; installmentAmount: number; firstDueDate: string };
export type CreditUpdate = { name?: string; accountId?: string; status?: CreditStatus; installmentAmount?: number };
export type ReplanPayload = { count: number; amount: number; firstDueDate: string; lastAmount?: number };
export type PayPayload = { paidDate?: string; paidAmount?: number; accountId?: string };
export type InstallmentUpdate = { dueDate?: string; amount?: number };
export type FinanceImportReport = { accounts: number; incomes: number; credits: number; installments: number };

export const ACCOUNT_TYPE_LABELS: Record<FinanceAccountType, string> = {
  PERSONAL: "Personal",
  BUSINESS: "Negocio",
  OTHER: "Otro",
};

export const CREDIT_STATUS_LABELS: Record<CreditStatus, string> = {
  ACTIVE: "Activo",
  PAID_OFF: "Pagado",
  CANCELLED: "Cancelado",
};
