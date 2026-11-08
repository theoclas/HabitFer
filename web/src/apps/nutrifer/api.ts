import { api } from "../../api/client";
import type {
  AmountChoice,
  DayView,
  Entry,
  FavoriteFood,
  FoodDetail,
  FoodResult,
  MealSlot,
  ProfileInput,
  ProfileResponse,
  RecentFood,
  RecipeDetail,
  RecipeInput,
  RecipeSummary,
  SavedMealView,
  Shortcuts,
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

/** Lo que sale al abrir una comida: comidas guardadas, favoritos y lo que más anotas ahí. */
export async function fetchShortcuts(meal: MealSlot | undefined) {
  const { data } = await api.get<Shortcuts>("/nutrition/shortcuts", { params: meal ? { meal } : {} });
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

export async function fetchFavorites() {
  const { data } = await api.get<FavoriteFood[]>("/nutrition/favorites");
  return data;
}

export async function setFavorite(foodId: string, on: boolean) {
  if (on) await api.put(`/nutrition/favorites/${foodId}`);
  else await api.delete(`/nutrition/favorites/${foodId}`);
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

export type QuickInput = { name?: string; kcal: number; protein?: number; fat?: number; carbs?: number };

export async function addQuickEntry(payload: QuickInput & { date: string; meal: MealSlot }) {
  const { data } = await api.post<Entry>("/nutrition/entries/quick", payload);
  return data;
}

export type EntryChanges = Partial<AmountChoice> & Partial<QuickInput> & { meal?: MealSlot; date?: string };

export async function updateEntry(id: string, payload: EntryChanges) {
  const { data } = await api.patch<Entry>(`/nutrition/entries/${id}`, payload);
  return data;
}

export async function deleteEntry(id: string) {
  await api.delete(`/nutrition/entries/${id}`);
}

/** Borrar varias de una vez (deshacer, vaciar una comida). */
export async function removeEntries(ids: string[]) {
  const { data } = await api.post<{ removed: number }>("/nutrition/entries/remove", { ids });
  return data;
}

/** Volver a anotar algo que ya se anotó, en este día y comida. */
export async function repeatEntry(id: string, target: { date: string; meal: MealSlot }) {
  const { data } = await api.post<Entry>(`/nutrition/entries/${id}/repeat`, target);
  return data;
}

export type CopyInput = { fromDate: string; fromMeal?: MealSlot; toDate: string; toMeal?: MealSlot };

export async function copyEntries(payload: CopyInput) {
  const { data } = await api.post<{ entries: Entry[]; kcal: number }>("/nutrition/copy", payload);
  return data;
}

export async function addWater(date: string, deltaMl: number) {
  const { data } = await api.post<{ date: string; ml: number }>("/nutrition/water", { date, deltaMl });
  return data;
}

/* ---------- Comidas guardadas ---------- */

export async function fetchSavedMeals() {
  const { data } = await api.get<SavedMealView[]>("/nutrition/saved-meals");
  return data;
}

export async function createSavedMeal(payload: { name: string; date: string; meal: MealSlot }) {
  const { data } = await api.post<SavedMealView>("/nutrition/saved-meals", payload);
  return data;
}

export async function updateSavedMeal(id: string, payload: { name?: string; itemIds?: string[] }) {
  const { data } = await api.patch<SavedMealView>(`/nutrition/saved-meals/${id}`, payload);
  return data;
}

export async function deleteSavedMeal(id: string) {
  await api.delete(`/nutrition/saved-meals/${id}`);
}

export async function logSavedMeal(id: string, payload: { date: string; meal: MealSlot; itemIds?: string[] }) {
  const { data } = await api.post<{ entries: Entry[]; kcal: number }>(`/nutrition/saved-meals/${id}/log`, payload);
  return data;
}

/* ---------- Recetas ---------- */

export async function fetchRecipes() {
  const { data } = await api.get<RecipeSummary[]>("/nutrition/recipes");
  return data;
}

export async function fetchRecipe(id: string) {
  const { data } = await api.get<RecipeDetail>(`/nutrition/recipes/${id}`);
  return data;
}

export async function saveRecipe(payload: RecipeInput, id?: string) {
  const { data } = id ? await api.put<RecipeDetail>(`/nutrition/recipes/${id}`, payload) : await api.post<RecipeDetail>("/nutrition/recipes", payload);
  return data;
}

export async function deleteRecipe(id: string) {
  await api.delete(`/nutrition/recipes/${id}`);
}

/* ---------- Meta ---------- */

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
