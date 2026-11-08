/** Tipos de NutriFer (lo que responde /api/nutrition). */

export type MealSlot = "DESAYUNO" | "MEDIAS_NUEVES" | "ALMUERZO" | "ONCES" | "COMIDA";
export const MEAL_ORDER: MealSlot[] = ["DESAYUNO", "MEDIAS_NUEVES", "ALMUERZO", "ONCES", "COMIDA"];

export type FoodSource = "TCAC" | "P18" | "DISH" | "USDA" | "OFF" | "USER" | "RECIPE";

/** Cómo se preparó: con aceite suma sus calorías. */
export type Prep = "COCIDO" | "ASADO" | "SUDADO" | "FRITO";

export type Portion = { id: string; label: string; grams: number };

export type FoodResult = {
  id: string;
  name: string;
  category: string | null;
  source: FoodSource;
  kcal100: number;
  portion: Portion | null;
  kcalPortion: number | null;
  isDish: boolean;
};

/** Lo que se anotó la última vez, para repetirlo igual con un toque. */
export type LastAmount = { entryId: string; portionLabel: string | null; quantity: number; grams: number | null; kcal: number; amount?: string };

export type RecentFood = FoodResult & {
  timesUsed: number;
  favorite: boolean;
  last: LastAmount;
};

export type FavoriteFood = FoodResult & { favorite: true; last: LastAmount | null };

export type SavedMealView = {
  id: string;
  name: string;
  meal: MealSlot | null;
  lastUsedAt: string | null;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  items: { id: string; name: string; amount: string; kcal: number; quick: boolean }[];
};

export type Shortcuts = { favorites: FavoriteFood[]; recents: RecentFood[]; savedMeals: SavedMealView[] };

export type Per100 = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
  satFat?: number | null;
};

export type FoodDetail = {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  source: FoodSource;
  sourceLabel: string;
  own: boolean;
  favorite?: boolean;
  per100: Per100;
  extra: { key: string; label: string; unit: string; value: number }[];
  portions: (Portion & { isDefault: boolean })[];
  parts: { id: string; label: string; grams: number; foodId: string; foodName: string; per100: Per100 }[];
};

export type Totals = { kcal: number; protein: number; fat: number; carbs: number; fiber: number; sugar: number; sodium: number };

export type EntryPart = { partId: string; label: string; foodId: string; grams: number; included: boolean };

export type Entry = {
  id: string;
  date: string;
  meal: MealSlot;
  foodId: string | null;
  name: string;
  quick: boolean;
  portionLabel: string | null;
  portionGrams: number | null;
  quantity: number;
  grams: number | null;
  prep: Prep | null;
  oilGrams: number | null;
  amount: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  parts: EntryPart[] | null;
};

export type MacroTargets = { kcal: number; protein: number; fat: number; carbs: number };

/** Lo de siempre en una comida que aún no está anotado. */
export type Suggestion = { entryId: string; foodId: string | null; name: string; amount: string; kcal: number; days: number };

/** La última vez que hubo algo (en una comida o en el día). */
export type PreviousMeal = { date: string; count: number; kcal: number };

export type WaterView = { ml: number; goalMl: number; glassMl: number };

export type MealView = {
  slot: MealSlot;
  name: string;
  entries: Entry[];
  totals: Totals;
  suggestions: Suggestion[];
  previous: PreviousMeal | null;
};

export type DayView = {
  date: string;
  meals: MealView[];
  totals: Totals;
  targets: MacroTargets | null;
  previousDay: PreviousMeal | null;
  water: WaterView;
  /** Los 7 días que terminan en este, con sus calorías. */
  week: WeekDay[];
};

export type WeekDay = { date: string; kcal: number; count: number };

export type Sex = "MALE" | "FEMALE";
export type WeightGoal = "LOSE" | "MAINTAIN" | "GAIN";

export type Targets = MacroTargets & { age: number; bmr: number; tdee: number; floorApplied: boolean };

export type ProfileView = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: number;
  goal: WeightGoal;
  ratePerWeek: number;
  manual: boolean;
  targets: MacroTargets;
  suggested: Targets;
  waterGoalMl: number;
  glassMl: number;
};

export type ActivityLevel = { factor: number; label: string; hint: string };

export type ProfileResponse = {
  profile: ProfileView | null;
  mealNames: Record<MealSlot, string>;
  activityLevels: ActivityLevel[];
};

export type ProfileInput = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: number;
  goal: WeightGoal;
  ratePerWeek: number;
  manual?: boolean;
  kcalTarget?: number;
  proteinTarget?: number;
  fatTarget?: number;
  carbsTarget?: number;
  mealNames?: Partial<Record<MealSlot, string>>;
  waterGoalMl?: number;
  glassMl?: number;
};

/** Lo que el usuario elige al anotar: una medida y cuántas, o gramos, en un plato qué partes, y cómo se preparó. */
export type AmountChoice = {
  portionId?: string;
  grams?: number;
  quantity: number;
  parts?: { partId: string; included: boolean; grams?: number }[];
  prep?: Prep | null;
  oilGrams?: number | null;
};

/** Lo que falta para la meta del día (para «anotar por meta»). */
export type Remaining = { kcal: number; protein: number; carbs: number; fat: number };

/* ---------- Recetas ---------- */

export type RecipeSummary = {
  id: string;
  name: string;
  servings: number;
  ingredients: number;
  servingGrams: number;
  kcalServing: number;
  proteinServing: number;
};

export type RecipeIngredient = {
  id?: string;
  foodId: string;
  name: string;
  portionLabel: string | null;
  quantity: number;
  grams: number;
  amount: string;
  per100: Per100;
};

export type RecipeDetail = {
  id: string;
  name: string;
  servings: number;
  cookedGrams: number | null;
  servingGrams: number;
  ingredients: RecipeIngredient[];
};

export type RecipeInput = {
  name: string;
  servings: number;
  cookedGrams?: number | null;
  ingredients: { foodId: string; portionLabel?: string; grams?: number; quantity?: number }[];
};
