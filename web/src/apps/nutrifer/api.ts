import { api } from "../../api/client";
import type {
  AmountChoice,
  AutoSource,
  BarcodeResult,
  Chain,
  BatchItem,
  FastingState,
  HabitLinks,
  MonthRecap,
  NutritionImportReport,
  OffHit,
  PlanKind,
  PlanWeek,
  DayView,
  Entry,
  FavoriteFood,
  Insights,
  Report,
  WeightsView,
  FoodDetail,
  FoodResult,
  MealSlot,
  PendingPhoto,
  ProfileInput,
  ProfileResponse,
  RecentFood,
  RecipeDetail,
  RecipeInput,
  RecipeSummary,
  SavedMealView,
  Shortcuts,
  Targets,
  TextItem,
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
  /** Lo que trae el paquete entero (g o ml). */
  packageGrams?: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  satFat?: number;
  sweetener?: boolean;
  brand?: string;
  barcode?: string;
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

/* ---------- Código de barras y empacados ---------- */

export async function lookupBarcode(code: string) {
  const { data } = await api.get<BarcodeResult>(`/nutrition/barcode/${encodeURIComponent(code)}`);
  return data;
}

export async function searchOff(q: string) {
  const { data } = await api.get<OffHit[]>("/nutrition/off/search", { params: { q } });
  return data;
}

/** Guardar en la base un empacado que salió en la búsqueda de Open Food Facts. */
export async function saveOff(code: string) {
  const { data } = await api.post<BarcodeResult>(`/nutrition/off/${encodeURIComponent(code)}`);
  return data;
}

/* ---------- Escribe o dicta y fotos para después ---------- */

export async function understandText(text: string) {
  const { data } = await api.post<{ items: TextItem[] }>("/nutrition/understand", { text });
  return data.items;
}

export async function addEntriesBatch(payload: { date: string; items: BatchItem[]; aliases?: { phrase: string; foodId: string }[]; photoId?: string }) {
  const { data } = await api.post<{ entries: Entry[]; kcal: number }>("/nutrition/entries/batch", payload);
  return data;
}

export async function uploadPhoto(payload: { date: string; meal: MealSlot; image: string; mime: string; note?: string }) {
  const { data } = await api.post<PendingPhoto & { meal: MealSlot }>("/nutrition/photos", payload);
  return data;
}

/** La foto como blob (la ruta pide la sesión, así que no sirve un <img src> directo). */
export async function fetchPhotoBlob(id: string) {
  const { data } = await api.get<Blob>(`/nutrition/photos/${id}`, { responseType: "blob" });
  return data;
}

export async function deletePhoto(id: string) {
  await api.delete(`/nutrition/photos/${id}`);
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

/* ---------- Peso, informe, descubrimientos y gasto real ---------- */

export async function fetchWeights(days: number) {
  const { data } = await api.get<WeightsView>("/nutrition/weights", { params: { days } });
  return data;
}

export async function saveWeight(date: string, kg: number) {
  const { data } = await api.put<{ date: string; kg: number }>(`/nutrition/weights/${date}`, { kg });
  return data;
}

export async function deleteWeight(date: string) {
  await api.delete(`/nutrition/weights/${date}`);
}

/** Llave nueva para el atajo de iOS (se muestra una sola vez). */
export async function createShortcutKey() {
  const { data } = await api.post<{ token: string; hint: string }>("/nutrition/shortcut");
  return data;
}

export async function deleteShortcutKey() {
  await api.delete("/nutrition/shortcut");
}

export async function fetchReport(from: string, to: string) {
  const { data } = await api.get<Report>("/nutrition/progress", { params: { from, to } });
  return data;
}

export async function fetchInsights() {
  const { data } = await api.get<Insights>("/nutrition/insights");
  return data;
}

/* ---------- Ayuno ---------- */

export async function fetchFasting() {
  const { data } = await api.get<FastingState>("/nutrition/fasting");
  return data;
}

export async function startFast(payload: { startedAt?: string; goalHours?: number } = {}) {
  const { data } = await api.post<FastingState>("/nutrition/fasting/start", payload);
  return data;
}

export async function stopFast(payload: { endedAt?: string } = {}) {
  const { data } = await api.post<FastingState>("/nutrition/fasting/stop", payload);
  return data;
}

export async function updateFast(id: string, payload: { startedAt?: string; endedAt?: string; goalHours?: number }) {
  const { data } = await api.patch<FastingState>(`/nutrition/fasting/${id}`, payload);
  return data;
}

export async function deleteFast(id: string) {
  const { data } = await api.delete<FastingState>(`/nutrition/fasting/${id}`);
  return data;
}

export async function saveFastSettings(payload: { goalHours?: number; notify?: boolean }) {
  const { data } = await api.put<FastingState>("/nutrition/fasting/settings", payload);
  return data;
}

/* ---------- Conexión con HabitFer ---------- */

export async function fetchHabitLinks() {
  const { data } = await api.get<HabitLinks>("/nutrition/habits");
  return data;
}

export async function linkHabit(source: AutoSource, habitId: string | null) {
  const { data } = await api.put<HabitLinks>(`/nutrition/habits/${source}`, habitId ? { habitId } : {});
  return data;
}

export async function createLinkedHabit(source: AutoSource) {
  const { data } = await api.post<HabitLinks>(`/nutrition/habits/${source}`);
  return data;
}

/* ---------- Plan de la semana y mercado ---------- */

export async function fetchPlan(from: string) {
  const { data } = await api.get<PlanWeek>("/nutrition/plan", { params: { from } });
  return data;
}

export async function addPlanItem(payload: { date: string; meal: MealSlot; kind: PlanKind; refId: string; servings?: number }) {
  const { data } = await api.post<{ id: string }>("/nutrition/plan", payload);
  return data;
}

export async function updatePlanItem(id: string, payload: { servings?: number; date?: string; meal?: MealSlot }) {
  await api.patch(`/nutrition/plan/${id}`, payload);
}

export async function deletePlanItem(id: string) {
  await api.delete(`/nutrition/plan/${id}`);
}

export async function logPlanItem(id: string) {
  const { data } = await api.post<{ date: string; meal: MealSlot; entries: number; kcal: number }>(`/nutrition/plan/${id}/log`);
  return data;
}

export async function copyPlanWeek(from: string, to: string) {
  const { data } = await api.post<{ copied: number }>("/nutrition/plan/copy", { from, to });
  return data;
}

/* ---------- Cadenas colombianas ---------- */

export async function fetchChains() {
  const { data } = await api.get<Chain[]>("/nutrition/chains");
  return data;
}

/* ---------- Tu mes en comida ---------- */

export async function fetchMonthRecap(month: string) {
  const { data } = await api.get<MonthRecap>("/nutrition/month", { params: { month } });
  return data;
}

/* ---------- Respaldo ---------- */

/** Descarga el respaldo de NutriFer (JSON) o el diario (CSV) como archivo. */
export async function downloadNutritionBackup(kind: "json" | "csv") {
  const res = await api.get<Blob>(kind === "json" ? "/nutrition/export" : "/nutrition/export/csv", { responseType: "blob" });
  const disposition = String(res.headers["content-disposition"] ?? "");
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? (kind === "json" ? "nutrifer-respaldo.json" : "nutrifer-diario.csv");
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

export async function importNutritionBackup(backup: unknown) {
  const { data } = await api.post<NutritionImportReport>("/nutrition/export/import", backup, { timeout: 120000 });
  return data;
}
