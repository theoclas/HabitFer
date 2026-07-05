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
  account?: { id: string; name: string; color: string | null };
  installments?: CreditInstallment[];
};

export type FinanceMovement = {
  id: string;
  type: "income" | "installment_paid" | "installment_pending";
  date: string;
  amount: number;
  label: string;
  accountId: string;
  accountName: string;
  creditId?: string;
  installmentId?: string;
  status?: string;
};

export type FinanceProjectionMonth = {
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

export type FinanceSummary = {
  from: string;
  to: string;
  accountId: string | null;
  totals: {
    income: number;
    paidInstallments: number;
    available: number;
    committed: number;
  };
  movements: FinanceMovement[];
  projection: FinanceProjectionMonth[];
};

export type CreateFinanceAccountPayload = {
  name: string;
  type?: FinanceAccountType;
  color?: string;
};

export type CreateIncomePayload = {
  accountId: string;
  amount: number;
  date: string;
  description?: string;
};

export type CreateCreditPayload = {
  accountId: string;
  name: string;
  totalAmount: number;
  installmentAmount: number;
  firstDueDate: string;
};

export const ACCOUNT_TYPE_LABELS: Record<FinanceAccountType, string> = {
  PERSONAL: "Personal",
  BUSINESS: "Empresa / negocio",
  OTHER: "Otro",
};
