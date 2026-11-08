/** Tipos de NutriFer (lo que responde /api/nutrition). */

export type MealSlot = "DESAYUNO" | "MEDIAS_NUEVES" | "ALMUERZO" | "ONCES" | "COMIDA";
export const MEAL_ORDER: MealSlot[] = ["DESAYUNO", "MEDIAS_NUEVES", "ALMUERZO", "ONCES", "COMIDA"];

export type FoodSource = "TCAC" | "P18" | "DISH" | "USDA" | "OFF" | "USER";

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

export type RecentFood = FoodResult & {
  timesUsed: number;
  last: { portionLabel: string | null; quantity: number; grams: number | null; kcal: number };
};

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
  portionLabel: string | null;
  portionGrams: number | null;
  quantity: number;
  grams: number | null;
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

export type DayView = {
  date: string;
  meals: { slot: MealSlot; name: string; entries: Entry[]; totals: Totals }[];
  totals: Totals;
  targets: MacroTargets | null;
};

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
};

/** Lo que el usuario elige al anotar: una medida y cuántas, o gramos, y en un plato qué partes. */
export type AmountChoice = {
  portionId?: string;
  grams?: number;
  quantity: number;
  parts?: { partId: string; included: boolean; grams?: number }[];
};
