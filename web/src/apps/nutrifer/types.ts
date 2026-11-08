/** Tipos de NutriFer (lo que responde /api/nutrition). */

export type MealSlot = "DESAYUNO" | "MEDIAS_NUEVES" | "ALMUERZO" | "ONCES" | "COMIDA";
export const MEAL_ORDER: MealSlot[] = ["DESAYUNO", "MEDIAS_NUEVES", "ALMUERZO", "ONCES", "COMIDA"];

export type FoodSource = "TCAC" | "P18" | "DISH" | "USDA" | "OFF" | "USER" | "RECIPE";

/** Cómo se preparó: con aceite suma sus calorías. */
export type Prep = "COCIDO" | "ASADO" | "SUDADO" | "FRITO";

export type Portion = { id: string; label: string; grams: number };

/** Sellos de advertencia de los empaques colombianos (Resolución 810), calculados. */
export type Seal = "AZUCARES" | "SODIO" | "GRASAS_SATURADAS" | "GRASAS_TRANS" | "EDULCORANTE";

export type FoodResult = {
  id: string;
  name: string;
  category: string | null;
  source: FoodSource;
  kcal100: number;
  portion: Portion | null;
  kcalPortion: number | null;
  isDish: boolean;
  seals?: Seal[];
};

/** Lo que responde el código de barras. */
export type BarcodeResult =
  | { status: "found"; foodId: string; from: "base" | "off"; check: boolean }
  | { status: "no-table"; code: string; name: string | null; brand: string | null }
  | { status: "unknown"; code: string };

/** Un empacado de Open Food Facts encontrado por nombre (todavía puede no estar guardado). */
export type OffHit = {
  code: string;
  name: string;
  brand: string | null;
  kcal100: number;
  portion: { label: string; grams: number } | null;
  kcalPortion: number | null;
  /** Bebida: la medida va en ml. */
  liquid: boolean;
  check: boolean;
  foodId: string | null;
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

/** Lo que se anotó la última vez de un alimento (el editor arranca con eso: «aprende tus porciones»). */
export type UsualAmount = {
  portionLabel: string | null;
  quantity: number;
  grams: number | null;
  prep: Prep | null;
  oilGrams: number | null;
  parts: EntryPart[] | null;
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
  usual?: UsualAmount | null;
  barcode?: string | null;
  seals?: Seal[];
  /** Los datos (de Open Food Facts) no cuadran: revisar con el empaque. */
  check?: boolean;
  /** Las calorías se calcularon con los macros. */
  estimated?: boolean;
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
  /** Si el alimento trae cada dato (en el día; los registros rápidos no traen ninguno). */
  known?: { fiber: boolean; sugar: boolean; sodium: boolean };
};

export type MacroTargets = { kcal: number; protein: number; fat: number; carbs: number };

/** Metas del día: los macros y, aparte, fibra (mínimo), azúcar y sodio (límites). */
export type DayTargets = MacroTargets & { fiber: number; sugar: number; sodium: number };

/** Cuántas anotaciones del día traen cada dato (la tabla del ICBF no trae azúcares). */
export type KnownNutrients = { entries: number; fiber: number; sugar: number; sodium: number };

/** La revisión de esta semana movió la meta. */
export type WeekAdjust = { weekStart: string; before: number; after: number; observed: number | null; formula: number };

/** Lo de siempre en una comida que aún no está anotado. */
export type Suggestion = { entryId: string; foodId: string | null; name: string; amount: string; kcal: number; days: number };

/** La última vez que hubo algo (en una comida o en el día). */
export type PreviousMeal = { date: string; count: number; kcal: number };

export type WaterView = { ml: number; goalMl: number; glassMl: number };

/** Foto para anotar después. */
export type PendingPhoto = { id: string; note: string | null; createdAt: string };

export type MealView = {
  slot: MealSlot;
  name: string;
  entries: Entry[];
  totals: Totals;
  suggestions: Suggestion[];
  previous: PreviousMeal | null;
  photos: PendingPhoto[];
};

/* ---------- Escribe o dicta ---------- */

/** Un alimento posible para lo que se escribió, con lo necesario para cambiar la cantidad sin volver a preguntar. */
export type TextCandidate = {
  id: string;
  name: string;
  source: FoodSource;
  isDish: boolean;
  canPrep: boolean;
  per100: Per100;
  portions: (Portion & { isDefault: boolean })[];
};

export type TextProposal = {
  portionId: string | null;
  quantity: number;
  grams: number | null;
  prep: Prep | null;
  oilGrams: number | null;
  how: "gramos" | "medida" | "lo-de-siempre" | "por-defecto";
};

export type TextItem = {
  key: string;
  phrase: string;
  name: string;
  /** Para recordar el alimento elegido si se corrige. */
  aliasKey: string;
  meal: MealSlot | null;
  /** El primer candidato es el que el usuario eligió otra vez para esta frase. */
  learned: boolean;
  candidates: TextCandidate[];
  proposals: Record<string, TextProposal>;
};

export type BatchItem = {
  meal: MealSlot;
  foodId: string;
  portionId?: string;
  grams?: number;
  quantity?: number;
  prep?: Prep;
  oilGrams?: number;
};

export type DayView = {
  date: string;
  meals: MealView[];
  totals: Totals;
  targets: DayTargets | null;
  known: KnownNutrients;
  adjust: WeekAdjust | null;
  previousDay: PreviousMeal | null;
  water: WaterView;
  /** Los 7 días que terminan en este, con sus calorías. */
  week: WeekDay[];
};

export type WeekDay = { date: string; kcal: number; count: number };

export type Sex = "MALE" | "FEMALE";
export type WeightGoal = "LOSE" | "MAINTAIN" | "GAIN";

export type Targets = MacroTargets & {
  age: number;
  bmr: number;
  tdee: number;
  floorApplied: boolean;
  /** Gasto con la fórmula (el `tdee` puede ser el medido de esta semana). */
  formulaTdee?: number;
  /** La meta sale del gasto medido con el peso y lo comido. */
  measured?: boolean;
};

export type ProfileView = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: number;
  goal: WeightGoal;
  ratePerWeek: number;
  manual: boolean;
  /** Meta que se ajusta sola cada semana. */
  adaptive: boolean;
  targets: MacroTargets;
  nutrients: { fiber: number; sugar: number; sodium: number };
  suggested: Targets;
  /** El peso de tendencia de hoy (null sin pesadas recientes). */
  trendKg: number | null;
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
  adaptive?: boolean;
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

/* ---------- Peso, informe, descubrimientos y gasto real ---------- */

export type WeightSource = "MANUAL" | "SHORTCUT";

export type WeightPoint = { date: string; kg: number; trend: number; source: WeightSource };

export type WeightsView = {
  today: string;
  points: WeightPoint[];
  /** La última pesada, su tendencia y cuánto cambió (null sin pesadas). */
  summary: {
    date: string;
    kg: number;
    trend: number;
    change7: number | null;
    change30: number | null;
    weeklyRate: number | null;
  } | null;
  /** El atajo de iOS conectado (null si no hay llave). */
  shortcut: { hint: string; lastUsedAt: string | null; createdAt: string } | null;
};

export type ReportDay = {
  date: string;
  entries: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar: number;
  sodium: number;
  meals: Record<MealSlot, number>;
};

export type Report = {
  from: string;
  to: string;
  today: string;
  targets: DayTargets | null;
  mealNames: Record<MealSlot, string>;
  days: ReportDay[];
  summary: {
    logged: number;
    avg: Totals | null;
    inTarget: number | null;
    proteinDays: number | null;
    sodiumOver: number | null;
  };
  meals: { slot: MealSlot; name: string; kcal: number; share: number }[];
  topFoods: { foodId: string | null; name: string; kcal: number; times: number; share: number }[];
};

export type Discovery = { id: string; text: string; detail: string; tone: "good" | "watch" | "neutral" };

export type Expenditure = {
  status: "collecting" | "ready";
  loggedDays: number;
  spanDays: number;
  weighIns: number;
  missingDays: number;
  needWeighIns: number;
  intakeAvg: number | null;
  trendChange: number | null;
  observed: number | null;
  confidence: number;
  formula: number;
  tdee: number;
};

export type EnergyView = {
  adaptive: boolean;
  manual: boolean;
  live: Expenditure;
  nextReview: string;
  history: {
    weekStart: string;
    tdee: number;
    formula: number;
    observed: number | null;
    weightKg: number;
    kcalBefore: number;
    kcalTarget: number;
    loggedDays: number;
    spanDays: number;
  }[];
};

export type Insights = {
  discoveries: { from: string; to: string; loggedDays: number; items: Discovery[] };
  energy: EnergyView | null;
};
