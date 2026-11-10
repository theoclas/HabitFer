import { api } from "../../api/client";
import type {
  AccountPayload,
  BulkPayload,
  CategoryPayload,
  CategoryUpdate,
  Credit,
  CreditPayload,
  CreditUpdate,
  FinanceAccount,
  FinanceAccountType,
  FinanceCategory,
  FinanceImportReport,
  FinanceKeyword,
  FinanceShortcut,
  FinanceSummary,
  InstallmentUpdate,
  MovementItem,
  MovementsQuery,
  MovementsResponse,
  ParseResult,
  PayPayload,
  QuickData,
  ReconcileResult,
  ReplanPayload,
  ShortcutPayload,
  TransactionPayload,
  TransactionUpdate,
} from "./types";

/** Lo que se mira: una cuenta, un libro o todo. */
export type ScopeParams = { accountId?: string; book?: FinanceAccountType };

/* ---------- Cuentas ---------- */

export async function fetchFinanceAccounts(opts: { archived?: boolean } = {}) {
  const { data } = await api.get<FinanceAccount[]>("/fernance/accounts", { params: opts.archived ? { archivadas: "1" } : undefined });
  return data;
}

export async function createFinanceAccount(payload: AccountPayload) {
  const { data } = await api.post<FinanceAccount>("/fernance/accounts", payload);
  return data;
}

export async function updateFinanceAccount(id: string, payload: Partial<AccountPayload>) {
  const { data } = await api.patch<FinanceAccount>("/fernance/accounts/" + id, payload);
  return data;
}

/** A la papelera (se puede restaurar). */
export async function archiveFinanceAccount(id: string) {
  const { data } = await api.delete<FinanceAccount>("/fernance/accounts/" + id);
  return data;
}

export async function restoreFinanceAccount(id: string) {
  const { data } = await api.post<FinanceAccount>("/fernance/accounts/" + id + "/restore");
  return data;
}

/** Para siempre, con sus movimientos y créditos. Solo desde la papelera. */
export async function purgeFinanceAccount(id: string) {
  await api.delete("/fernance/accounts/" + id + "/permanent");
}

/** Cuadrar con el banco: el saldo que dice el banco (y su fecha, por defecto hoy). */
export async function reconcileAccount(id: string, balance: number, date?: string) {
  const { data } = await api.post<ReconcileResult>("/fernance/accounts/" + id + "/reconcile", { balance, ...(date ? { date } : {}) });
  return data;
}

/* ---------- Movimientos ---------- */

export async function fetchMovements(params: MovementsQuery) {
  const { data } = await api.get<MovementsResponse>("/fernance/movements", { params });
  return data;
}

export async function createTransaction(payload: TransactionPayload) {
  const { data } = await api.post<MovementItem>("/fernance/transactions", payload);
  return data;
}

export async function updateTransaction(id: string, payload: TransactionUpdate) {
  const { data } = await api.patch<MovementItem>("/fernance/transactions/" + id, payload);
  return data;
}

export async function deleteTransaction(id: string) {
  await api.delete("/fernance/transactions/" + id);
}

export async function bulkTransactions(payload: BulkPayload) {
  const { data } = await api.post<{ count: number; skipped: number }>("/fernance/transactions/bulk", payload);
  return data;
}

/* ---------- Categorías, palabras y lo de siempre ---------- */

export async function fetchCategories(opts: { archived?: boolean } = {}) {
  const { data } = await api.get<FinanceCategory[]>("/fernance/categories", { params: opts.archived ? { archivadas: "1" } : undefined });
  return data;
}

export async function createCategory(payload: CategoryPayload) {
  const { data } = await api.post<FinanceCategory>("/fernance/categories", payload);
  return data;
}

export async function updateCategory(id: string, payload: CategoryUpdate) {
  const { data } = await api.patch<FinanceCategory>("/fernance/categories/" + id, payload);
  return data;
}

export async function archiveCategory(id: string) {
  const { data } = await api.delete<FinanceCategory>("/fernance/categories/" + id);
  return data;
}

export async function restoreCategory(id: string) {
  const { data } = await api.post<FinanceCategory>("/fernance/categories/" + id + "/restore");
  return data;
}

export async function parseMoneyText(text: string, signal?: AbortSignal) {
  const { data } = await api.post<ParseResult>("/fernance/parse", { text }, { signal });
  return data;
}

export async function fetchKeywords() {
  const { data } = await api.get<FinanceKeyword[]>("/fernance/keywords");
  return data;
}

export async function teachKeyword(payload: { keyword: string; categoryId?: string; accountId?: string }) {
  const { data } = await api.post<FinanceKeyword>("/fernance/keywords", payload);
  return data;
}

export async function deleteKeyword(id: string) {
  await api.delete("/fernance/keywords/" + id);
}

export async function fetchQuick() {
  const { data } = await api.get<QuickData>("/fernance/quick");
  return data;
}

export async function createShortcut(payload: ShortcutPayload) {
  const { data } = await api.post<FinanceShortcut>("/fernance/shortcuts", payload);
  return data;
}

export async function updateShortcut(id: string, payload: Partial<ShortcutPayload>) {
  const { data } = await api.patch<FinanceShortcut>("/fernance/shortcuts/" + id, payload);
  return data;
}

export async function deleteShortcut(id: string) {
  await api.delete("/fernance/shortcuts/" + id);
}

/* ---------- Créditos y cuotas ---------- */

export async function fetchCredits(params?: ScopeParams) {
  const { data } = await api.get<Credit[]>("/fernance/credits", { params });
  return data;
}

export async function fetchCredit(id: string) {
  const { data } = await api.get<Credit>("/fernance/credits/" + id);
  return data;
}

export async function createCredit(payload: CreditPayload) {
  const { data } = await api.post<Credit>("/fernance/credits", payload);
  return data;
}

export async function updateCredit(id: string, payload: CreditUpdate) {
  const { data } = await api.patch<Credit>("/fernance/credits/" + id, payload);
  return data;
}

export async function replanCredit(id: string, payload: ReplanPayload) {
  const { data } = await api.put<Credit>("/fernance/credits/" + id + "/plan", payload);
  return data;
}

export async function deleteCredit(id: string) {
  await api.delete("/fernance/credits/" + id);
}

export async function payInstallment(id: string, payload: PayPayload = {}) {
  const { data } = await api.patch<Credit>("/fernance/installments/" + id + "/pay", payload);
  return data;
}

export async function unpayInstallment(id: string) {
  const { data } = await api.patch<Credit>("/fernance/installments/" + id + "/unpay");
  return data;
}

export async function updateInstallment(id: string, payload: InstallmentUpdate) {
  const { data } = await api.patch<Credit>("/fernance/installments/" + id, payload);
  return data;
}

export async function deleteInstallment(id: string) {
  const { data } = await api.delete<Credit>("/fernance/installments/" + id);
  return data;
}

/* ---------- Resumen y respaldo ---------- */

export async function fetchFinanceSummary(params?: ScopeParams & { from?: string; to?: string }) {
  const { data } = await api.get<FinanceSummary>("/fernance/summary", { params });
  return data;
}

/** Descarga el respaldo (JSON) o los movimientos (CSV) y devuelve el nombre del archivo. */
export async function downloadFinanceBackup(kind: "json" | "csv"): Promise<string> {
  const res = await api.get<Blob>(kind === "json" ? "/fernance/export" : "/fernance/export/csv", { responseType: "blob" });
  const header = String(res.headers["content-disposition"] ?? "");
  const name = /filename="([^"]+)"/.exec(header)?.[1] ?? (kind === "json" ? "ferfinance-respaldo.json" : "ferfinance-movimientos.csv");
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}

export async function importFinanceBackup(body: unknown) {
  const { data } = await api.post<FinanceImportReport>("/fernance/export/import", body, { timeout: 120000 });
  return data;
}
