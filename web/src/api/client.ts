import axios from "axios";

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
  }
}

import type { CompleteHabitResponse, CreateHabitPayload, Habit, HabitToday } from "../types";

export async function fetchHabits() {
  const { data } = await api.get<Habit[]>("/habits");
  return data;
}

export async function fetchHabitsToday(date?: string) {
  const { data } = await api.get<HabitToday[]>("/habits/today", { params: date ? { date } : undefined });
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

export async function completeHabit(id: string, date?: string) {
  const { data } = await api.post<CompleteHabitResponse>("/habits/" + id + "/complete", date ? { date } : {});
  return data;
}

export async function uncompleteHabit(id: string, date: string) {
  const { data } = await api.delete<Habit>("/habits/" + id + "/complete/" + date);
  return data;
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
