import axios from "axios";
import { todayKey } from "../utils/dates";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4001/api";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("habitfer_token");
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

let authRedirectPending = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url ?? "");
    const isAuthRoute = url.includes("/auth/login") || url.includes("/auth/register");
    if ((status === 401 || status === 403) && !isAuthRoute && !authRedirectPending) {
      authRedirectPending = true;
      localStorage.removeItem("habitfer_token");
      if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export async function login(login: string, password: string) {
  const { data } = await api.post("/auth/login", { login, password });
  if (data.token) localStorage.setItem("habitfer_token", data.token);
  return data;
}

export async function register(payload: { email: string; username: string; fullName: string; password: string }) {
  const { data } = await api.post("/auth/register", payload);
  if (data.token) localStorage.setItem("habitfer_token", data.token);
  return data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    localStorage.removeItem("habitfer_token");
    // Datos guardados para usar sin conexion: no deben quedar para la siguiente sesion.
    try {
      void window.caches?.delete("hf-api").catch(() => undefined);
    } catch {
      /* sin cache */
    }
  }
}

import type {
  AchievementsSummary,
  CompleteHabitResponse,
  CreateHabitPayload,
  DayMood,
  FreezeBalance,
  Habit,
  HabitAchievementRow,
  HabitPause,
  HabitToday,
  CoachMessage,
  CoachState,
  ImportReport,
  Insight,
  MonthSummary,
  StatsRange,
} from "../types";

export async function fetchHabits() {
  const { data } = await api.get<Habit[]>("/habits");
  return data;
}

export async function fetchHabitsToday(date?: string) {
  const { data } = await api.get<HabitToday[]>("/habits/today", { params: date ? { date } : undefined });
  return data;
}

export async function fetchAchievementsSummary() {
  const { data } = await api.get<AchievementsSummary>("/habits/achievements");
  return data;
}

export async function fetchHabit(id: string) {
  const { data } = await api.get<Habit>("/habits/" + id);
  return data;
}

export async function createHabit(payload: CreateHabitPayload) {
  const { data } = await api.post<Habit>("/habits", payload);
  return data;
}

export async function updateHabit(id: string, payload: Partial<CreateHabitPayload> & { archived?: boolean }) {
  const { data } = await api.patch<Habit>("/habits/" + id, payload);
  return data;
}

export async function deleteHabit(id: string) {
  await api.delete("/habits/" + id);
}

/** Marca el habito. Con `note` guarda (o cambia) la nota de ese dia; sin ella conserva la que hubiera. */
export async function completeHabit(id: string, date: string = todayKey(), note?: string) {
  const body = note === undefined ? { date } : { date, note };
  const { data } = await api.post<CompleteHabitResponse>("/habits/" + id + "/complete", body);
  return data;
}

export async function uncompleteHabit(id: string, date: string) {
  const { data } = await api.delete<Habit>("/habits/" + id + "/complete/" + date);
  return data;
}

export async function fetchHabitAchievements(id: string) {
  const { data } = await api.get<HabitAchievementRow[]>("/habits/" + id + "/achievements");
  return data;
}

export async function fetchArchivedHabits() {
  const { data } = await api.get<Habit[]>("/habits/archived");
  return data;
}

/** Nuevo orden de los habitos (ids de arriba a abajo). */
export async function reorderHabits(ids: string[]) {
  await api.post("/habits/reorder", { ids });
}

/** Varios habitos a la vez (plantillas). */
export async function createHabitsBulk(habits: CreateHabitPayload[]) {
  const { data } = await api.post<Habit[]>("/habits/bulk", { habits });
  return data;
}

/** Cantidad de un dia en un habito medible (0 borra el avance). */
export async function setHabitProgress(id: string, date: string, value: number, note?: string) {
  const body = note === undefined ? { value } : { value, note };
  const { data } = await api.put<CompleteHabitResponse>("/habits/" + id + "/progress/" + date, body);
  return data;
}

export async function relapseHabit(id: string, payload: { date?: string; note?: string } = {}) {
  const { data } = await api.post<{ habit: Habit }>("/habits/" + id + "/relapse", payload);
  return data.habit;
}

export async function removeRelapse(id: string, date: string) {
  const { data } = await api.delete<{ habit: Habit }>("/habits/" + id + "/relapse/" + date);
  return data.habit;
}

export async function fetchFreezes() {
  const { data } = await api.get<FreezeBalance>("/habits/freezes");
  return data;
}

export async function freezeHabitDay(id: string, date: string) {
  const { data } = await api.post<{ habit: Habit; freezes: FreezeBalance }>("/habits/" + id + "/freeze/" + date);
  return data;
}

export async function unfreezeHabitDay(id: string, date: string) {
  const { data } = await api.delete<{ habit: Habit; freezes: FreezeBalance }>("/habits/" + id + "/freeze/" + date);
  return data;
}

export async function fetchPauses() {
  const { data } = await api.get<HabitPause[]>("/habits/pauses");
  return data;
}

/** Sin habitId, pausa todos los habitos (vacaciones). */
export async function createPause(payload: { habitId?: string; startDate: string; endDate: string; note?: string }) {
  const { data } = await api.post<HabitPause>("/habits/pauses", payload);
  return data;
}

export async function fetchInsights() {
  const { data } = await api.get<Insight[]>("/stats/insights");
  return data;
}

/** Resumen de un mes (YYYY-MM; por defecto el actual). */
export async function fetchMonthSummary(month?: string) {
  const { data } = await api.get<MonthSummary>("/stats/month", { params: month ? { month } : undefined });
  return data;
}

/** Descarga el respaldo (JSON completo) o el historial (CSV) como archivo. */
export async function downloadBackup(kind: "json" | "csv") {
  const res = await api.get<Blob>(kind === "json" ? "/export" : "/export/csv", { responseType: "blob" });
  const disposition = String(res.headers["content-disposition"] ?? "");
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? (kind === "json" ? "habitfer-respaldo.json" : "habitfer-historial.csv");
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}

/** Importa un respaldo: suma lo que falta, nunca borra. */
export async function importBackup(backup: unknown) {
  const { data } = await api.post<ImportReport>("/export/import", backup, { timeout: 120000 });
  return data;
}

export async function fetchCoach() {
  const { data } = await api.get<CoachState>("/coach");
  return data;
}

export async function generateCoach() {
  const { data } = await api.post<CoachMessage>("/coach/generate", undefined, { timeout: 150000 });
  return data;
}

export async function markCoachRead(id: string) {
  await api.post("/coach/" + id + "/read");
}

export async function setCoachEnabled(enabled: boolean) {
  const { data } = await api.patch<CoachState>("/coach/settings", { enabled });
  return data;
}

/** Termina una pausa: si no habia empezado se borra; si ya corria, termina ayer. */
export async function endPause(id: string) {
  const { data } = await api.delete<{ ok: boolean; removed: boolean }>("/habits/pauses/" + id);
  return data;
}

export async function fetchStatsRange(params: { from?: string; to?: string; habitId?: string } = {}) {
  const { data } = await api.get<StatsRange>("/stats/range", { params });
  return data;
}

export async function fetchMoods(from: string, to: string) {
  const { data } = await api.get<DayMood[]>("/moods", { params: { from, to } });
  return data;
}

export async function setMood(date: string, mood: number) {
  const { data } = await api.put<DayMood>("/moods/" + date, { mood });
  return data;
}

export async function clearMood(date: string) {
  await api.delete("/moods/" + date);
}

import type { CreateProjectPayload, CreateTaskPayload, Project, Task, TaskStatus } from "../types";

export async function fetchProjects() {
  const { data } = await api.get<Project[]>("/projects");
  return data;
}

export async function createProject(payload: CreateProjectPayload) {
  const { data } = await api.post<Project>("/projects", payload);
  return data;
}

export async function updateProject(id: string, payload: Partial<CreateProjectPayload> & { archived?: boolean }) {
  const { data } = await api.patch<Project>("/projects/" + id, payload);
  return data;
}

export async function deleteProject(id: string) {
  await api.delete("/projects/" + id);
}

export async function fetchTasks(params?: { projectId?: string; status?: TaskStatus }) {
  const { data } = await api.get<Task[]>("/tasks", { params });
  return data;
}

export async function fetchTasksToday() {
  const { data } = await api.get<Task[]>("/tasks/today");
  return data;
}

export async function createTask(payload: CreateTaskPayload) {
  const { data } = await api.post<Task>("/tasks", payload);
  return data;
}

export async function updateTask(id: string, payload: Partial<CreateTaskPayload>) {
  const { data } = await api.patch<Task>("/tasks/" + id, payload);
  return data;
}

export async function deleteTask(id: string) {
  await api.delete("/tasks/" + id);
}

import type { ReminderItem } from "../types";

export async function fetchReminders() {
  const { data } = await api.get<ReminderItem[]>("/reminders");
  return data;
}

export async function fetchReminderCount() {
  const { data } = await api.get<{ count: number }>("/reminders/count");
  return data.count;
}

export async function markReminderRead(id: string) {
  await api.post("/reminders/" + id + "/read");
}

export async function markAllRemindersRead() {
  await api.post("/reminders/read-all");
}

/* ---------- Notificaciones push ---------- */

export async function fetchPushPublicKey() {
  const { data } = await api.get<{ publicKey: string | null }>("/push/public-key");
  return data;
}

export async function subscribePush(payload: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }) {
  const { data } = await api.post<{ ok: boolean; devices: number }>("/push/subscribe", payload);
  return data;
}

export async function unsubscribePush(endpoint: string) {
  const { data } = await api.post<{ ok: boolean; devices: number }>("/push/unsubscribe", { endpoint });
  return data;
}

export type PushSettings = { enabled: boolean; devices: number; summaryTime: string | null };

export async function fetchPushSettings() {
  const { data } = await api.get<PushSettings>("/push/settings");
  return data;
}

export async function updatePushSettings(payload: { summaryTime: string | null }) {
  const { data } = await api.patch<PushSettings>("/push/settings", payload);
  return data;
}

export async function sendTestPush() {
  const { data } = await api.post<{ sent: number; removed: number }>("/push/test");
  return data;
}

import type { HabitStatsDetail, StatsOverview, TaskStatsSummary } from "../types";

export async function fetchStatsOverview() {
  const { data } = await api.get<StatsOverview>("/stats/overview");
  return data;
}

export async function fetchHabitStats(id: string) {
  const { data } = await api.get<HabitStatsDetail>("/stats/habits/" + id);
  return data;
}

export async function fetchTaskStats() {
  const { data } = await api.get<TaskStatsSummary>("/stats/tasks");
  return data;
}

import type { CreateUserPayload, ManagedUser, UserStatus } from "../types";

export async function fetchUsers(status?: UserStatus) {
  const { data } = await api.get<ManagedUser[]>("/users", { params: status ? { status } : undefined });
  return data;
}

export async function createUser(payload: CreateUserPayload) {
  const { data } = await api.post<ManagedUser>("/users", payload);
  return data;
}

export async function updateUser(id: string, payload: Partial<CreateUserPayload>) {
  const { data } = await api.patch<ManagedUser>("/users/" + id, payload);
  return data;
}

export async function deleteUser(id: string) {
  await api.delete("/users/" + id);
}

export async function approveUser(id: string) {
  const { data } = await api.patch<ManagedUser>("/users/" + id + "/approve");
  return data;
}

export async function rejectUser(id: string) {
  const { data } = await api.patch<ManagedUser>("/users/" + id + "/reject");
  return data;
}

export async function suspendUser(id: string) {
  const { data } = await api.patch<ManagedUser>("/users/" + id + "/suspend");
  return data;
}

import type {
  CreateCreditPayload,
  CreateFinanceAccountPayload,
  CreateIncomePayload,
  Credit,
  FinanceAccount,
  FinanceSummary,
  Income,
} from "../types/fernance";

export async function fetchFinanceAccounts() {
  const { data } = await api.get<FinanceAccount[]>("/fernance/accounts");
  return data;
}

export async function createFinanceAccount(payload: CreateFinanceAccountPayload) {
  const { data } = await api.post<FinanceAccount>("/fernance/accounts", payload);
  return data;
}

export async function updateFinanceAccount(id: string, payload: Partial<CreateFinanceAccountPayload>) {
  const { data } = await api.patch<FinanceAccount>("/fernance/accounts/" + id, payload);
  return data;
}

export async function deleteFinanceAccount(id: string) {
  await api.delete("/fernance/accounts/" + id);
}

export async function fetchIncomes(params?: { accountId?: string; from?: string; to?: string }) {
  const { data } = await api.get<Income[]>("/fernance/incomes", { params });
  return data;
}

export async function createIncome(payload: CreateIncomePayload) {
  const { data } = await api.post<Income>("/fernance/incomes", payload);
  return data;
}

export async function updateIncome(id: string, payload: Partial<CreateIncomePayload>) {
  const { data } = await api.patch<Income>("/fernance/incomes/" + id, payload);
  return data;
}

export async function deleteIncome(id: string) {
  await api.delete("/fernance/incomes/" + id);
}

export async function fetchCredits(params?: { accountId?: string; status?: string }) {
  const { data } = await api.get<Credit[]>("/fernance/credits", { params });
  return data;
}

export async function fetchCredit(id: string) {
  const { data } = await api.get<Credit>("/fernance/credits/" + id);
  return data;
}

export async function createCredit(payload: CreateCreditPayload) {
  const { data } = await api.post<Credit>("/fernance/credits", payload);
  return data;
}

export async function updateCredit(id: string, payload: { name?: string; status?: string }) {
  const { data } = await api.patch<Credit>("/fernance/credits/" + id, payload);
  return data;
}

export async function payInstallment(id: string) {
  const { data } = await api.patch("/fernance/installments/" + id + "/pay");
  return data;
}

export async function unpayInstallment(id: string) {
  const { data } = await api.patch("/fernance/installments/" + id + "/unpay");
  return data;
}

export async function fetchFinanceSummary(params?: { accountId?: string; from?: string; to?: string }) {
  const { data } = await api.get<FinanceSummary>("/fernance/summary", { params });
  return data;
}
