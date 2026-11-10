import { api } from "../../api/client";
import type {
  AccountPayload,
  Credit,
  CreditPayload,
  CreditUpdate,
  FinanceAccount,
  FinanceImportReport,
  FinanceSummary,
  Income,
  IncomePayload,
  InstallmentUpdate,
  PayPayload,
  ReplanPayload,
} from "./types";

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

/** Para siempre, con sus ingresos y créditos. Solo desde la papelera. */
export async function purgeFinanceAccount(id: string) {
  await api.delete("/fernance/accounts/" + id + "/permanent");
}

/* ---------- Ingresos ---------- */

export async function fetchIncomes(params?: { accountId?: string; from?: string; to?: string }) {
  const { data } = await api.get<Income[]>("/fernance/incomes", { params });
  return data;
}

export async function createIncome(payload: IncomePayload) {
  const { data } = await api.post<Income>("/fernance/incomes", payload);
  return data;
}

export async function updateIncome(id: string, payload: Partial<IncomePayload>) {
  const { data } = await api.patch<Income>("/fernance/incomes/" + id, payload);
  return data;
}

export async function deleteIncome(id: string) {
  await api.delete("/fernance/incomes/" + id);
}

/* ---------- Créditos y cuotas ---------- */

export async function fetchCredits(params?: { accountId?: string }) {
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

export async function fetchFinanceSummary(params?: { accountId?: string; from?: string; to?: string }) {
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
