/** Cálculos de NutriFer: metas, porciones y sumas (funciones puras, con pruebas). */

export type Sex = 'MALE' | 'FEMALE';
export type WeightGoal = 'LOSE' | 'MAINTAIN' | 'GAIN';

/** Factores de actividad clásicos; el primero (1,2) es un punto de partida conservador. */
export const ACTIVITY_LEVELS = [
  { factor: 1.2, label: 'Sedentario', hint: 'Trabajo sentado y casi nada de ejercicio.' },
  { factor: 1.375, label: 'Poco activo', hint: 'Ejercicio suave de 1 a 3 días por semana.' },
  { factor: 1.55, label: 'Activo', hint: 'Ejercicio moderado de 3 a 5 días por semana.' },
  { factor: 1.725, label: 'Muy activo', hint: 'Ejercicio fuerte de 6 a 7 días por semana.' },
  { factor: 1.9, label: 'Atleta', hint: 'Entrenas dos veces al día o tu trabajo es físico y pesado.' },
] as const;

/** kcal por día que equivalen a 1 kg por semana (≈ 7.700 kcal por kg ÷ 7 días). */
export const KCAL_PER_KG_WEEK = 1100;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Metabolismo basal con la fórmula de Mifflin-St Jeor (1990). */
export function bmr(p: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'MALE' ? base + 5 : base - 161;
}

export type ProfileInput = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: number;
  goal: WeightGoal;
  ratePerWeek: number;
};

export type Targets = {
  age: number;
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** La meta quedó en el mínimo seguro (no se baja de ahí aunque el ritmo pida más). */
  floorApplied: boolean;
};

/**
 * Meta diaria: gasto = basal × actividad; bajar o subir resta o suma el ritmo (kg por semana × 1.100).
 * Nunca por debajo del basal ni de 1.500 kcal (hombres) o 1.200 kcal (mujeres).
 * Proteína: 1,8 g por kg al bajar y 1,6 g por kg si no, sobre el peso con IMC de 27 como máximo.
 * Grasa: 28 % de las calorías. Carbohidratos: el resto.
 */
export function computeTargets(p: ProfileInput, year = new Date().getFullYear()): Targets {
  const age = clamp(year - p.birthYear, 14, 100);
  const basal = bmr({ sex: p.sex, weightKg: p.weightKg, heightCm: p.heightCm, age });
  const tdee = basal * clamp(p.activity, 1.1, 2.2);
  const rate = clamp(p.ratePerWeek, 0, 1);
  const raw = p.goal === 'LOSE' ? tdee - rate * KCAL_PER_KG_WEEK : p.goal === 'GAIN' ? tdee + rate * KCAL_PER_KG_WEEK : tdee;
  const floor = Math.max(basal, p.sex === 'MALE' ? 1500 : 1200);
  const floorApplied = p.goal === 'LOSE' && raw < floor;
  const kcal = roundTo(Math.max(raw, p.goal === 'LOSE' ? floor : 0), 10);
  const heightM = p.heightCm / 100;
  const proteinWeight = Math.min(p.weightKg, 27 * heightM * heightM);
  const protein = Math.round((p.goal === 'LOSE' ? 1.8 : 1.6) * proteinWeight);
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { age, bmr: Math.round(basal), tdee: Math.round(tdee), kcal, protein, fat, carbs, floorApplied };
}

/* ---------- Valores de lo que se come ---------- */

/** Valores por 100 g (los opcionales pueden faltar en la fuente). */
export type Per100 = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
};

export type Totals = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar: number;
  sodium: number;
};

export const ZERO: Totals = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 };

/** Valores de `grams` gramos de un alimento. */
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

export function sumTotals(list: Totals[]): Totals {
  return list.reduce(
    (acc, t) => ({
      kcal: acc.kcal + t.kcal,
      protein: acc.protein + t.protein,
      fat: acc.fat + t.fat,
      carbs: acc.carbs + t.carbs,
      fiber: acc.fiber + t.fiber,
      sugar: acc.sugar + t.sugar,
      sodium: acc.sodium + t.sodium,
    }),
    ZERO,
  );
}

/** Para mostrar y guardar: kcal y sodio enteros, el resto con un decimal. */
export function roundTotals(t: Totals): Totals {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round(t.kcal),
    protein: r1(t.protein),
    fat: r1(t.fat),
    carbs: r1(t.carbs),
    fiber: r1(t.fiber),
    sugar: r1(t.sugar),
    sodium: Math.round(t.sodium),
  };
}

/** Una parte de un plato tal como se anota: con sus gramos y si se comió o no. */
export type DishPartInput = { per100: Per100; grams: number; included: boolean };

/** Gramos y valores de un plato por partes (solo las incluidas), por `quantity` porciones. */
export function dishTotals(parts: DishPartInput[], quantity: number): { grams: number; totals: Totals } {
  const q = Math.max(0, quantity);
  const eaten = parts.filter((p) => p.included);
  const grams = eaten.reduce((g, p) => g + p.grams, 0) * q;
  return { grams, totals: sumTotals(eaten.map((p) => scale(p.per100, p.grams * q))) };
}

/** Valores por 100 g de un plato a partir de sus partes (para buscar y mostrar el plato completo). */
export function per100FromParts(parts: { per100: Per100; grams: number }[]): Per100 {
  const grams = parts.reduce((g, p) => g + p.grams, 0);
  if (grams <= 0) return { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 };
  const t = sumTotals(parts.map((p) => scale(p.per100, p.grams)));
  const f = 100 / grams;
  return {
    kcal: t.kcal * f,
    protein: t.protein * f,
    fat: t.fat * f,
    carbs: t.carbs * f,
    fiber: t.fiber * f,
    sugar: t.sugar * f,
    sodium: t.sodium * f,
  };
}

/** Energía que explican los macros (Atwater 4/4/9); sirve para detectar datos raros. */
export function atwaterKcal(p: { protein: number; fat: number; carbs: number }): number {
  return 4 * p.protein + 4 * p.carbs + 9 * p.fat;
}

/** Cantidad legible: 1, 1½, 2, 0,5 → "½". */
export function formatQuantity(q: number): string {
  const whole = Math.floor(q + 1e-9);
  const frac = q - whole;
  const halves = Math.abs(frac - 0.5) < 0.01;
  if (halves) return whole === 0 ? '½' : `${whole}½`;
  if (frac < 0.01) return String(whole);
  return String(Math.round(q * 100) / 100).replace('.', ',');
}
