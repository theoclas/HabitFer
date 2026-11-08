/** Cuentas de NutriFer en el teléfono, para ver el total mientras se elige (el servidor las repite al guardar). */
import type { AmountChoice, FoodDetail, Per100, Prep, Totals } from "./types";

export const ZERO: Totals = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 };

export function scale(per100: Per100, grams: number): Totals {
  const f = Math.max(0, grams) / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    fat: per100.fat * f,
    carbs: per100.carbs * f,
    fiber: (per100.fiber ?? 0) * f,
    sugar: (per100.sugar ?? 0) * f,
    sodium: (per100.sodium ?? 0) * f,
  };
}

export function add(a: Totals, b: Totals): Totals {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    fiber: a.fiber + b.fiber,
    sugar: a.sugar + b.sugar,
    sodium: a.sodium + b.sodium,
  };
}

/* ---------- Cómo se preparó ---------- */

/** Aceite vegetal: 900 kcal y 100 g de grasa por 100 g (tabla del ICBF). */
export const OIL_PER100: Per100 = { kcal: 900, protein: 0, fat: 100, carbs: 0 };
/** Media cucharadita. */
export const OIL_STEP = 2.5;
export const MAX_OIL = 300;

/** Preparaciones y el aceite que suelen llevar (parte del peso de lo que se cocina). */
export const PREP_OPTIONS: { value: Prep; label: string; pct: number }[] = [
  { value: "COCIDO", label: "Cocido o al vapor", pct: 0 },
  { value: "ASADO", label: "A la plancha o asado", pct: 0.03 },
  { value: "SUDADO", label: "Sudado o guisado", pct: 0.05 },
  { value: "FRITO", label: "Frito", pct: 0.1 },
];

/** Aceite que suele llevar, en medias cucharaditas (media como mínimo si lleva). */
export function suggestedOil(prep: Prep, grams: number): number {
  const pct = PREP_OPTIONS.find((p) => p.value === prep)?.pct ?? 0;
  if (pct <= 0 || grams <= 0) return 0;
  return Math.min(MAX_OIL, Math.max(OIL_STEP, Math.round((grams * pct) / OIL_STEP) * OIL_STEP));
}

/** Lo que ya dice cómo se preparó (la tabla trae el aceite incluido). */
const READY = /frit|asad|dorad|sudad|guisad|apanad|propia grasa|horne|en aceite|tostad|ahumad/i;
const COOKABLE = ["Carnes", "Pescados", "Huevos", "Verduras", "Cereales", "Leguminosas", "Alimentos nativos"];

/** ¿Tiene sentido preguntar cómo se preparó? Carnes, pescados, huevos, verduras, cereales… crudos o cocidos. */
export function canPrep(food: Pick<FoodDetail, "name" | "category" | "source" | "parts">): boolean {
  if (food.parts.length > 0 || food.source === "RECIPE" || food.source === "DISH") return false;
  if (!food.category || READY.test(food.name)) return false;
  return COOKABLE.some((c) => food.category?.startsWith(c));
}

/* ---------- Anotar por meta ---------- */

export type GoalMacro = "protein" | "kcal" | "carbs" | "fat";

/** Gramos de un alimento para llegar a una meta («30 g de proteína de pechuga»); null si no aporta eso. */
export function gramsForGoal(per100: Per100, macro: GoalMacro, target: number): number | null {
  const per = per100[macro];
  if (!per || per <= 0 || target <= 0) return null;
  return Math.round((target / per) * 100);
}

/** Gramos y valores de lo que se está eligiendo (igual que computeEntry del servidor), con el aceite. */
export function previewAmount(food: FoodDetail, choice: AmountChoice): { grams: number; totals: Totals } {
  const q = Math.max(0, choice.quantity);
  if (food.parts.length > 0) {
    const chosen = new Map((choice.parts ?? []).map((p) => [p.partId, p]));
    let grams = 0;
    let totals = ZERO;
    for (const part of food.parts) {
      const c = chosen.get(part.id);
      if (c && !c.included) continue;
      const g = (c?.grams ?? part.grams) * q;
      grams += g;
      totals = add(totals, scale(part.per100, g));
    }
    return { grams, totals };
  }
  const portion = choice.portionId ? food.portions.find((p) => p.id === choice.portionId) : undefined;
  const grams = portion ? portion.grams * q : (choice.grams ?? 100);
  const base = scale(food.per100, grams);
  const oil = choice.oilGrams && choice.oilGrams > 0 ? Math.min(MAX_OIL, choice.oilGrams) : 0;
  return { grams, totals: oil > 0 ? add(base, scale(OIL_PER100, oil)) : base };
}

/* ---------- Aprende tus porciones ---------- */

/** Lo que se anotó la última vez, en el formato del editor (así arranca con tu porción, no con la de la tabla). */
export function usualChoice(food: FoodDetail): AmountChoice | undefined {
  const u = food.usual;
  if (!u) return undefined;
  if (food.parts.length > 0) {
    return { quantity: u.quantity, ...(u.parts ? { parts: u.parts.map((p) => ({ partId: p.partId, included: p.included })) } : {}) };
  }
  const prep = { prep: u.prep, oilGrams: u.oilGrams };
  if (u.portionLabel) {
    const wanted = u.portionLabel.toLowerCase();
    const portion = food.portions.find((p) => p.label.toLowerCase() === wanted);
    if (portion) return { portionId: portion.id, quantity: u.quantity, ...prep };
  }
  if (u.grams && u.grams > 0) return { grams: u.grams, quantity: 1, ...prep };
  return undefined;
}

/** Gramos, calorías y proteína de una cantidad (la revisión de «escribe o dicta»). */
export function amountOf(
  food: { per100: Per100; portions: { id: string; grams: number }[] },
  a: { portionId: string | null; quantity: number; grams: number | null; oilGrams?: number | null },
): { grams: number; kcal: number; protein: number } {
  const portion = a.portionId ? food.portions.find((p) => p.id === a.portionId) : undefined;
  const grams = portion ? portion.grams * a.quantity : (a.grams ?? 100);
  const t = scale(food.per100, grams);
  const oil = a.oilGrams && a.oilGrams > 0 ? a.oilGrams : 0;
  return { grams, kcal: t.kcal + (oil * OIL_PER100.kcal) / 100, protein: t.protein };
}

/* ---------- Recetas ---------- */

/** Toda la olla, el peso con que se reparte (el de la olla si se pesó) y una porción. */
export function recipePreview(items: { per100: Per100; grams: number }[], servings: number, cookedGrams?: number | null) {
  const rawGrams = items.reduce((g, i) => g + Math.max(0, i.grams), 0);
  const totals = items.reduce((t, i) => add(t, scale(i.per100, i.grams)), ZERO);
  const weight = cookedGrams && cookedGrams > 0 ? cookedGrams : rawGrams;
  const s = servings > 0 ? servings : 1;
  const perServing: Totals = {
    kcal: totals.kcal / s,
    protein: totals.protein / s,
    fat: totals.fat / s,
    carbs: totals.carbs / s,
    fiber: totals.fiber / s,
    sugar: totals.sugar / s,
    sodium: totals.sodium / s,
  };
  return { totals, rawGrams, weight, servingGrams: weight / s, perServing };
}

/**
 * Metas de los nutrientes, igual que en el servidor: fibra 14 g por cada 1.000 kcal (mínimo 25 g),
 * azúcares hasta el 10 % de las calorías y sodio hasta 2.000 mg.
 */
export function nutrientGoals(kcal: number): { fiber: number; sugar: number; sodium: number } {
  return { fiber: Math.max(25, Math.round((kcal / 1000) * 14)), sugar: Math.round((kcal * 0.1) / 4), sodium: 2000 };
}

/* ---------- Textos ---------- */

const nf0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** 1437 → «1.437». */
export const kcalText = (n: number) => nf0.format(Math.round(n));
/** Entero con separador de miles (gramos del resumen del día, donde no cabe el decimal). */
export const intText = (n: number) => nf0.format(Math.round(n));
/** 12.46 → «12,5». */
export const gramsText = (n: number) => nf1.format(Math.round(n * 10) / 10);

/** 1 → «1», 0.5 → «½», 1.5 → «1½», 0.25 → «0,25». */
export function quantityText(q: number): string {
  const whole = Math.floor(q + 1e-9);
  const frac = q - whole;
  if (Math.abs(frac - 0.5) < 0.01) return whole === 0 ? "½" : `${whole}½`;
  if (frac < 0.01) return String(whole);
  return nf1.format(Math.round(q * 100) / 100);
}

/** «1 cucharadita (5 g)», «½ cucharadita (2,5 g)», «3 cucharaditas (15 g)». */
export function oilText(g: number): string {
  if (g <= 0) return "Sin aceite";
  const tsp = g / 5;
  return `${quantityText(tsp)} ${tsp > 1 ? "cucharaditas" : "cucharadita"} (${gramsText(g)} g)`;
}

/** 300 → «300 ml», 1250 → «1,25 L». */
export function mlText(ml: number): string {
  if (ml < 1000) return `${Math.round(ml)} ml`;
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(ml / 1000)} L`;
}

/** Lo que falta para la meta (negativo si se pasó). */
export function remaining(target: number, eaten: number): number {
  return Math.round(target - eaten);
}

/* ---------- Fechas (AAAA-MM-DD, sin zona horaria) ---------- */

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAYS_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** «dom», «lun»… */
export function weekdayShort(key: string): string {
  return WEEKDAYS_SHORT[new Date(utc(key)).getUTCDay()];
}

/** «domingo 8» */
export function weekdayLong(key: string): string {
  const d = new Date(utc(key));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
}
const MONTHS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."];

const utc = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** El día `days` después (o antes, si es negativo) de `key`. */
export function shiftDay(key: string, days: number): string {
  const d = new Date(utc(key) + days * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** «hoy», «ayer», «el martes», «el 3 de nov.»: cuándo fue `key` visto desde `from`. */
export function relativeDay(key: string, from: string): string {
  const diff = Math.round((utc(from) - utc(key)) / 86_400_000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff === -1) return "mañana";
  const d = new Date(utc(key));
  if (diff > 1 && diff < 7) return `el ${WEEKDAYS[d.getUTCDay()]}`;
  return `el ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}
