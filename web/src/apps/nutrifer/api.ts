import { api } from "../../api/client";
import type {
  AmountChoice,
  DayView,
  Entry,
  FoodDetail,
  FoodResult,
  MealSlot,
  ProfileInput,
  ProfileResponse,
  RecentFood,
  Targets,
} from "./types";

/** Llamadas de NutriFer a /api/nutrition. */

export async function searchFoods(q: string, signal?: AbortSignal) {
  const { data } = await api.get<FoodResult[]>("/nutrition/foods/search", { params: { q }, signal });
  return data;
}

export async function recentFoods(meal: MealSlot) {
  const { data } = await api.get<RecentFood[]>("/nutrition/foods/recent", { params: { meal } });
  return data;
}

export async function foodDetail(id: string) {
  const { data } = await api.get<FoodDetail>(`/nutrition/foods/${id}`);
  return data;
}

export type NewFood = {
  name: string;
  portionLabel?: string;
  portionGrams?: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
};

export async function createFood(payload: NewFood) {
  const { data } = await api.post<FoodResult>("/nutrition/foods", payload);
  return data;
}

export async function fetchDay(date: string) {
  const { data } = await api.get<DayView>("/nutrition/day", { params: { date } });
  return data;
}

export type NewEntry = AmountChoice & { date: string; meal: MealSlot; foodId: string; portionLabel?: string };

export async function addEntry(payload: NewEntry) {
  const { data } = await api.post<Entry>("/nutrition/entries", payload);
  return data;
}

export async function updateEntry(id: string, payload: Partial<AmountChoice> & { meal?: MealSlot; date?: string }) {
  const { data } = await api.patch<Entry>(`/nutrition/entries/${id}`, payload);
  return data;
}

export async function deleteEntry(id: string) {
  await api.delete(`/nutrition/entries/${id}`);
}

export async function fetchProfile() {
  const { data } = await api.get<ProfileResponse>("/nutrition/profile");
  return data;
}

export async function saveProfile(payload: ProfileInput) {
  const { data } = await api.put<ProfileResponse>("/nutrition/profile", payload);
  return data;
}

export async function previewProfile(payload: ProfileInput, signal?: AbortSignal) {
  const { data } = await api.post<Targets>("/nutrition/profile/preview", payload, { signal });
  return data;
}
