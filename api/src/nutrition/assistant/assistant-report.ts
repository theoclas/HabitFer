import type {
  CookMethod,
  FoodSource,
  MealSlot,
  Sex,
  WeightGoal,
} from '@prisma/client';
import { localDateKey } from '../../common/date.utils';
import { amountText } from '../entry.utils';
import { MEAL_ORDER } from '../meals';
import { ACTIVITY_LEVELS } from '../nutrition-math';
import { daysBetween, eachDay, weekdayOf } from '../progress/days';
import type { Expenditure } from '../progress/expenditure';
import { nutrientGoals } from '../progress/goals';
import { trendSummary, weightTrend } from '../progress/trend';
import { normalize } from '../search.utils';

/*
 * El informe que lee un asistente (Claude) para ayudar con la dieta: el perfil y las metas, los promedios de los
 * días completos, por comida y por grupo, lo que más aporta, el peso, el gasto real, los ayunos y cada día con lo
 * que se comió. Sale en JSON o en Markdown (para pegarlo en un chat). Solo lee: no cambia nada.
 */

/* ---------- Lo que entra ---------- */

export type AssistantEntry = {
  date: string;
  meal: MealSlot;
  foodId: string | null;
  name: string;
  portionLabel: string | null;
  quantity: number;
  grams: number | null;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  quick: boolean;
  prep: CookMethod | null;
  oilGrams: number | null;
  /** Partes del plato que no se comió («sin chicharrón»). */
  skipped: string[];
  source: FoodSource | null;
  category: string | null;
  brand: string | null;
};

export type AssistantProfile = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: number;
  goal: WeightGoal;
  ratePerWeek: number;
  manual: boolean;
  adaptive: boolean;
  kcalTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbsTarget: number;
  waterGoalMl: number;
};

export type AssistantFast = {
  startedAt: string;
  endedAt: string | null;
  goalHours: number;
  hours: number;
  reached: boolean;
};

export type EnergyWeek = {
  weekStart: string;
  tdee: number;
  formula: number;
  observed: number | null;
  kcalBefore: number;
  kcalTarget: number;
};

export type AssistantInput = {
  generatedAt: Date;
  today: string;
  from: string;
  to: string;
  profile: AssistantProfile | null;
  mealNames: Record<MealSlot, string>;
  entries: AssistantEntry[];
  water: { date: string; ml: number }[];
  /** Pesadas hasta `to`, en orden (con semanas de antes para que la tendencia no arranque fría). */
  weights: { date: string; kg: number }[];
  energy: {
    live: Expenditure;
    nextReview: string;
    history: EnergyWeek[];
  } | null;
  fasting: {
    goalHours: number;
    streak: number;
    best: number;
    current: AssistantFast | null;
    history: AssistantFast[];
  } | null;
  discoveries: { text: string; detail: string; tone: string }[];
};

/* ---------- Lo que sale ---------- */

export type Totals = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar: number;
  sodium: number;
};

export type AssistantItem = {
  name: string;
  brand: string | null;
  /** «2 × arepa pequeña · 112 g · frito, +5 g de aceite». */
  amount: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  source: FoodSource | null;
  category: string | null;
  quick: boolean;
};

/** complete: cuenta en los promedios · incomplete: muy poco anotado (quedó a medias) · empty: nada · today: aún no termina. */
export type DayStatus = 'complete' | 'incomplete' | 'empty' | 'today';

export type AssistantDay = {
  date: string;
  weekday: string;
  status: DayStatus;
  totals: Totals;
  waterMl: number;
  weightKg: number | null;
  meals: {
    slot: MealSlot;
    name: string;
    kcal: number;
    items: AssistantItem[];
  }[];
};

export type TopItem = {
  name: string;
  times: number;
  amount: number;
  share: number;
};

export type AssistantReport = {
  app: 'NutriFer';
  version: 1;
  generatedAt: string;
  timeZone: string;
  period: {
    from: string;
    to: string;
    days: number;
    today: string;
    includesToday: boolean;
  };
  profile: {
    sex: 'hombre' | 'mujer';
    age: number;
    heightCm: number;
    profileWeightKg: number;
    trendWeightKg: number | null;
    goal: 'bajar' | 'mantener' | 'subir';
    ratePerWeekKg: number;
    activity: { factor: number; label: string };
    adaptiveGoal: boolean;
    manualTargets: boolean;
  } | null;
  targets: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiberMin: number;
    sugarMax: number;
    sodiumMax: number;
    waterMl: number;
  } | null;
  summary: {
    loggedDays: number;
    completeDays: number;
    /** Un día cuenta como completo con al menos estas kcal (el 40 % de la meta). */
    completeMinKcal: number;
    incompleteDays: string[];
    emptyDays: string[];
    avg: Totals | null;
    vsTarget: { kcal: number; share: number } | null;
    /** Parte de las calorías que sale de cada macro (proteína y carbohidratos × 4, grasa × 9). */
    macroSplit: { protein: number; fat: number; carbs: number } | null;
    proteinPerKg: number | null;
    daysInTarget: number | null;
    daysOver: number | null;
    daysUnder: number | null;
    proteinDays: number | null;
    fiberDays: number | null;
    sugarOverDays: number | null;
    sodiumOverDays: number | null;
    weekdayAvgKcal: number | null;
    weekendAvgKcal: number | null;
    water: {
      avgMl: number | null;
      daysLogged: number;
      daysAtGoal: number | null;
    };
    /** Parte de las calorías (días completos) que son registros rápidos: solo calorías, sin macros ni sodio. */
    quickShare: number;
    /** Parte de las calorías (días completos) con el azúcar conocido: la tabla del ICBF no lo trae. */
    sugarKnownShare: number;
  };
  meals: {
    slot: MealSlot;
    name: string;
    avgKcal: number;
    share: number;
    daysEaten: number;
  }[];
  groups: { name: string; kcal: number; share: number }[];
  top: {
    kcal: TopItem[];
    protein: TopItem[];
    sugar: TopItem[];
    sodium: TopItem[];
  };
  weight: {
    lastDate: string;
    lastKg: number;
    trendKg: number;
    change7: number | null;
    change30: number | null;
    weeklyRate: number | null;
    inPeriod: { date: string; kg: number; trend: number }[];
  } | null;
  energy: {
    status: Expenditure['status'];
    formulaKcal: number;
    observedKcal: number | null;
    usedKcal: number;
    confidence: number;
    loggedDays: number;
    spanDays: number;
    missingDays: number;
    nextReview: string;
    reviews: EnergyWeek[];
  } | null;
  fasting: {
    goalHours: number;
    streak: number;
    best: number;
    current: AssistantFast | null;
    recent: AssistantFast[];
  } | null;
  discoveries: { text: string; detail: string; tone: string }[];
  days: AssistantDay[];
  notes: string[];
};

/* ---------- Cálculo ---------- */

export const TIME_ZONE = 'America/Bogota';
/** Un día con menos del 40 % de la meta (u 800 kcal sin meta) seguro quedó a medias: igual que los descubrimientos. */
const COMPLETE_SHARE = 0.4;
const COMPLETE_FALLBACK_KCAL = 800;
/** Margen para contar un día «en la meta». */
const IN_TARGET_SHARE = 0.1;
/** Peso de tendencia «de hoy» si la última pesada es de hace máximo 2 semanas (como el perfil). */
const TREND_FRESH_DAYS = 14;

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const share = (part: number, all: number) =>
  all > 0 ? Math.round((part / all) * 1000) / 1000 : 0;
const mean = (list: number[]) =>
  list.length ? list.reduce((s, n) => s + n, 0) / list.length : 0;

const SEX_TEXT = { MALE: 'hombre', FEMALE: 'mujer' } as const;
const GOAL_TEXT = {
  LOSE: 'bajar',
  MAINTAIN: 'mantener',
  GAIN: 'subir',
} as const;
export const WEEKDAYS = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];
const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const zero = (): Totals => ({
  kcal: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
});
const roundTotals = (t: Totals): Totals => ({
  kcal: r0(t.kcal),
  protein: r1(t.protein),
  fat: r1(t.fat),
  carbs: r1(t.carbs),
  fiber: r1(t.fiber),
  sugar: r1(t.sugar),
  sodium: r0(t.sodium),
});
function addTo(t: Totals, e: AssistantEntry) {
  t.kcal += e.kcal;
  t.protein += e.protein;
  t.fat += e.fat;
  t.carbs += e.carbs;
  t.fiber += e.fiber ?? 0;
  t.sugar += e.sugar ?? 0;
  t.sodium += e.sodium ?? 0;
}

function activityOf(factor: number) {
  const near = ACTIVITY_LEVELS.reduce((a, b) =>
    Math.abs(b.factor - factor) < Math.abs(a.factor - factor) ? b : a,
  );
  return { factor, label: near.label as string };
}

/** Grupo de un alimento para el reparto: su categoría o, si no tiene, de dónde salió. */
function groupOf(e: AssistantEntry): string {
  if (e.quick) return 'Registros rápidos';
  if (e.category?.trim()) return e.category.trim();
  if (e.source === 'USER') return 'Alimentos propios';
  if (e.source === 'RECIPE') return 'Recetas propias';
  if (e.source === 'OFF') return 'Empacados';
  return 'Otros';
}

function itemOf(e: AssistantEntry): AssistantItem {
  let amount = e.quick
    ? 'registro rápido'
    : amountText({
        portionLabel: e.portionLabel,
        quantity: e.quantity,
        grams: e.grams,
        prep: e.prep,
        oilGrams: e.oilGrams,
      });
  if (e.skipped.length)
    amount = `${amount ? `${amount} · ` : ''}sin ${e.skipped.map((s) => s.toLowerCase()).join(', ')}`;
  return {
    name: e.name,
    brand: e.brand?.trim() || null,
    amount,
    kcal: r0(e.kcal),
    protein: r1(e.protein),
    fat: r1(e.fat),
    carbs: r1(e.carbs),
    fiber: e.fiber == null ? null : r1(e.fiber),
    sugar: e.sugar == null ? null : r1(e.sugar),
    sodium: e.sodium == null ? null : r0(e.sodium),
    source: e.source,
    category: e.category,
    quick: e.quick,
  };
}

/**
 * El azúcar de una anotación se conoce si viene del USDA, de un empacado (Open Food Facts) o de un alimento propio que
 * lo trae. La tabla del ICBF no trae azúcares, así que sus alimentos (y los platos y recetas armados con ellos) no.
 */
function sugarKnown(e: AssistantEntry): boolean {
  if (e.quick || e.sugar == null) return false;
  return e.source === 'USDA' || e.source === 'OFF' || e.source === 'USER';
}

/** Lo que más aportó de algo (calorías, sodio…): por alimento, o por nombre en los registros rápidos. */
export function topBy(
  entries: AssistantEntry[],
  pick: (e: AssistantEntry) => number | null,
  limit: number,
  decimals = false,
): TopItem[] {
  const by = new Map<string, { name: string; times: number; amount: number }>();
  let all = 0;
  for (const e of entries) {
    const v = pick(e) ?? 0;
    all += v;
    const key = e.foodId ?? `q:${normalize(e.name)}`;
    const cur = by.get(key) ?? { name: e.name, times: 0, amount: 0 };
    cur.times += 1;
    cur.amount += v;
    by.set(key, cur);
  }
  return [...by.values()]
    .filter((f) => f.amount > 0)
    .sort((a, b) => b.amount - a.amount || b.times - a.times)
    .slice(0, limit)
    .map((f) => ({
      ...f,
      amount: decimals ? r1(f.amount) : r0(f.amount),
      share: share(f.amount, all),
    }));
}

export function buildAssistantReport(input: AssistantInput): AssistantReport {
  const { from, to, today, profile, mealNames } = input;
  const targets = profile
    ? (() => {
        const goals = nutrientGoals(profile.kcalTarget);
        return {
          kcal: profile.kcalTarget,
          protein: profile.proteinTarget,
          fat: profile.fatTarget,
          carbs: profile.carbsTarget,
          fiberMin: goals.fiber,
          sugarMax: goals.sugar,
          sodiumMax: goals.sodium,
          waterMl: profile.waterGoalMl,
        };
      })()
    : null;
  const minKcal = r0(
    targets ? targets.kcal * COMPLETE_SHARE : COMPLETE_FALLBACK_KCAL,
  );

  // Peso y tendencia.
  const trend = weightTrend(input.weights);
  const trendInfo = trendSummary(trend);
  const kgByDay = new Map(input.weights.map((w) => [w.date, w.kg]));
  const trendFresh =
    trendInfo && daysBetween(trendInfo.last.date, today) <= TREND_FRESH_DAYS
      ? r2(trendInfo.last.trend)
      : null;

  // Cada día con sus comidas.
  const water = new Map(input.water.map((w) => [w.date, w.ml]));
  const byDay = new Map<string, AssistantEntry[]>();
  for (const e of input.entries) {
    if (e.date < from || e.date > to) continue;
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }
  const mealKcal = new Map<string, Record<MealSlot, number>>();
  const days: AssistantDay[] = eachDay(from, to).map((date) => {
    const list = byDay.get(date) ?? [];
    const totals = zero();
    const perMeal = {
      DESAYUNO: 0,
      MEDIAS_NUEVES: 0,
      ALMUERZO: 0,
      ONCES: 0,
      COMIDA: 0,
    } as Record<MealSlot, number>;
    for (const e of list) {
      addTo(totals, e);
      perMeal[e.meal] += e.kcal;
    }
    mealKcal.set(date, perMeal);
    const status: DayStatus =
      date === today
        ? 'today'
        : list.length === 0
          ? 'empty'
          : totals.kcal >= minKcal
            ? 'complete'
            : 'incomplete';
    return {
      date,
      weekday: WEEKDAYS[weekdayOf(date) - 1],
      status,
      totals: roundTotals(totals),
      waterMl: water.get(date) ?? 0,
      weightKg: kgByDay.has(date) ? r2(kgByDay.get(date)!) : null,
      meals: MEAL_ORDER.map((slot) => {
        const items = list.filter((e) => e.meal === slot);
        return {
          slot,
          name: mealNames[slot],
          kcal: r0(perMeal[slot]),
          items: items.map(itemOf),
        };
      }).filter((m) => m.items.length > 0),
    };
  });

  // Promedios de los días completos.
  const complete = days.filter((d) => d.status === 'complete');
  const avgOf = (pick: (t: Totals) => number) =>
    mean(complete.map((d) => pick(d.totals)));
  const avg: Totals | null = complete.length
    ? roundTotals({
        kcal: avgOf((t) => t.kcal),
        protein: avgOf((t) => t.protein),
        fat: avgOf((t) => t.fat),
        carbs: avgOf((t) => t.carbs),
        fiber: avgOf((t) => t.fiber),
        sugar: avgOf((t) => t.sugar),
        sodium: avgOf((t) => t.sodium),
      })
    : null;
  const kgForProtein = trendFresh ?? profile?.weightKg ?? null;
  const weekday = complete.filter((d) => weekdayOf(d.date) <= 5);
  const weekend = complete.filter((d) => weekdayOf(d.date) >= 6);
  const finished = days.filter((d) => d.status !== 'today');
  const waterDays = finished.filter((d) => d.waterMl > 0);
  const countIf = (ok: (d: AssistantDay) => boolean) =>
    targets ? complete.filter(ok).length : null;

  // Qué tan completos son los datos de los días completos.
  const inPeriod = input.entries.filter((e) => e.date >= from && e.date <= to);
  const completeDates = new Set(complete.map((d) => d.date));
  const completeEntries = inPeriod.filter((e) => completeDates.has(e.date));
  const kcalOf = (list: AssistantEntry[]) =>
    list.reduce((sum, e) => sum + e.kcal, 0);
  const completeEntriesKcal = kcalOf(completeEntries);
  const quickShare = share(
    kcalOf(completeEntries.filter((e) => e.quick)),
    completeEntriesKcal,
  );
  const sugarKnownShare = share(
    kcalOf(completeEntries.filter(sugarKnown)),
    completeEntriesKcal,
  );

  // Por comida (sobre los días completos).
  const completeKcal = complete.reduce((s, d) => s + d.totals.kcal, 0);
  const meals = MEAL_ORDER.map((slot) => {
    const kcal = complete.reduce(
      (s, d) => s + (mealKcal.get(d.date)?.[slot] ?? 0),
      0,
    );
    return {
      slot,
      name: mealNames[slot],
      avgKcal: complete.length ? r0(kcal / complete.length) : 0,
      share: share(kcal, completeKcal),
      daysEaten: complete.filter((d) => (mealKcal.get(d.date)?.[slot] ?? 0) > 0)
        .length,
    };
  });

  // Por grupo y lo que más aportó (todo el periodo).
  const allKcal = kcalOf(inPeriod);
  const groupKcal = new Map<string, number>();
  for (const e of inPeriod)
    groupKcal.set(groupOf(e), (groupKcal.get(groupOf(e)) ?? 0) + e.kcal);
  const groups = [...groupKcal.entries()]
    .filter(([, kcal]) => kcal > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, kcal]) => ({
      name,
      kcal: r0(kcal),
      share: share(kcal, allKcal),
    }));

  const fasting =
    input.fasting && (input.fasting.current || input.fasting.history.length > 0)
      ? {
          goalHours: input.fasting.goalHours,
          streak: input.fasting.streak,
          best: input.fasting.best,
          current: input.fasting.current,
          recent: input.fasting.history.filter((f) => {
            const day = localDateKey(new Date(f.startedAt));
            return day >= from && day <= to;
          }),
        }
      : null;

  const energy = input.energy
    ? {
        status: input.energy.live.status,
        formulaKcal: input.energy.live.formula,
        observedKcal: input.energy.live.observed,
        usedKcal: input.energy.live.tdee,
        confidence: r2(input.energy.live.confidence),
        loggedDays: input.energy.live.loggedDays,
        spanDays: input.energy.live.spanDays,
        missingDays: input.energy.live.missingDays,
        nextReview: input.energy.nextReview,
        reviews: input.energy.history.slice(0, 4),
      }
    : null;

  const includesToday = to >= today;
  const notes = [
    'P = proteína, G = grasa, C = carbohidratos (en gramos); el sodio va en miligramos.',
    'Valores de la tabla de alimentos colombianos del ICBF (TCAC), de platos armados por partes, del USDA, de Open Food Facts (empacados) o de alimentos que creó el usuario.',
    'Las calorías ya incluyen el aceite de la preparación cuando se anotó (frito, asado o sudado).',
    'La tabla del ICBF no trae azúcares: el total de azúcares solo cuenta los empacados, lo del USDA y los alimentos propios que los traen (el real es mayor).',
    'Los registros rápidos son solo calorías: de esos no se sabe la proteína, la grasa, los carbohidratos ni el sodio.',
    `Un día cuenta como completo con al menos ${minKcal} kcal (el 40 % de la meta): los que tienen menos seguro quedaron a medias y no cuentan en los promedios.`,
    ...(includesToday
      ? [
          'Hoy aún no termina: sale en el detalle, pero no cuenta en los promedios.',
        ]
      : []),
    'Metas de fibra (14 g por cada 1.000 kcal, mínimo 25 g), azúcares (máximo el 10 % de las calorías) y sodio (máximo 2.000 mg): IOM y OMS.',
    'El peso de tendencia es un promedio que no se deja llevar por un día con mucha agua.',
    'Este informe es de solo lectura: quien lo lee no puede anotar ni cambiar nada en NutriFer.',
  ];

  return {
    app: 'NutriFer',
    version: 1,
    generatedAt: input.generatedAt.toISOString(),
    timeZone: TIME_ZONE,
    period: { from, to, days: daysBetween(from, to) + 1, today, includesToday },
    profile: profile
      ? {
          sex: SEX_TEXT[profile.sex],
          age: input.generatedAt.getFullYear() - profile.birthYear,
          heightCm: profile.heightCm,
          profileWeightKg: profile.weightKg,
          trendWeightKg: trendFresh,
          goal: GOAL_TEXT[profile.goal],
          ratePerWeekKg: profile.ratePerWeek,
          activity: activityOf(profile.activity),
          adaptiveGoal: profile.adaptive,
          manualTargets: profile.manual,
        }
      : null,
    targets,
    summary: {
      loggedDays: days.filter((d) => d.meals.length > 0).length,
      completeDays: complete.length,
      completeMinKcal: minKcal,
      incompleteDays: days
        .filter((d) => d.status === 'incomplete')
        .map((d) => d.date),
      emptyDays: days.filter((d) => d.status === 'empty').map((d) => d.date),
      avg,
      vsTarget:
        avg && targets
          ? {
              kcal: avg.kcal - targets.kcal,
              share: share(avg.kcal - targets.kcal, targets.kcal),
            }
          : null,
      macroSplit:
        avg && avg.kcal > 0
          ? {
              protein: share(avg.protein * 4, avg.kcal),
              fat: share(avg.fat * 9, avg.kcal),
              carbs: share(avg.carbs * 4, avg.kcal),
            }
          : null,
      proteinPerKg: avg && kgForProtein ? r2(avg.protein / kgForProtein) : null,
      daysInTarget: countIf(
        (d) =>
          Math.abs(d.totals.kcal - targets!.kcal) <=
          targets!.kcal * IN_TARGET_SHARE,
      ),
      daysOver: countIf(
        (d) => d.totals.kcal > targets!.kcal * (1 + IN_TARGET_SHARE),
      ),
      daysUnder: countIf(
        (d) => d.totals.kcal < targets!.kcal * (1 - IN_TARGET_SHARE),
      ),
      proteinDays: countIf((d) => d.totals.protein >= targets!.protein * 0.9),
      fiberDays: countIf((d) => d.totals.fiber >= targets!.fiberMin),
      sugarOverDays: countIf((d) => d.totals.sugar > targets!.sugarMax),
      sodiumOverDays: countIf((d) => d.totals.sodium > targets!.sodiumMax),
      weekdayAvgKcal: weekday.length
        ? r0(mean(weekday.map((d) => d.totals.kcal)))
        : null,
      weekendAvgKcal: weekend.length
        ? r0(mean(weekend.map((d) => d.totals.kcal)))
        : null,
      water: {
        avgMl: waterDays.length
          ? r0(mean(waterDays.map((d) => d.waterMl)))
          : null,
        daysLogged: waterDays.length,
        daysAtGoal: targets
          ? waterDays.filter((d) => d.waterMl >= targets.waterMl).length
          : null,
      },
      quickShare,
      sugarKnownShare,
    },
    meals,
    groups,
    top: {
      kcal: topBy(inPeriod, (e) => e.kcal, 12),
      protein: topBy(inPeriod, (e) => e.protein, 6, true),
      sugar: topBy(inPeriod, (e) => e.sugar, 6, true),
      sodium: topBy(inPeriod, (e) => e.sodium, 6),
    },
    weight: trendInfo
      ? {
          lastDate: trendInfo.last.date,
          lastKg: r2(trendInfo.last.kg),
          trendKg: r2(trendInfo.last.trend),
          change7: trendInfo.change7 == null ? null : r2(trendInfo.change7),
          change30: trendInfo.change30 == null ? null : r2(trendInfo.change30),
          weeklyRate:
            trendInfo.weeklyRate == null ? null : r2(trendInfo.weeklyRate),
          inPeriod: trend
            .filter((p) => p.date >= from && p.date <= to)
            .map((p) => ({ date: p.date, kg: r2(p.kg), trend: r2(p.trend) })),
        }
      : null,
    energy,
    fasting,
    discoveries: input.discoveries.map(({ text, detail, tone }) => ({
      text,
      detail,
      tone,
    })),
    days,
    notes,
  };
}

/* ---------- Markdown ---------- */

const nf0 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const nf3 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });
const n0 = (n: number) => nf0.format(n);
const n1 = (n: number) => nf1.format(n);
const kc = (n: number) => `${n0(n)} kcal`;
const pct = (s: number) => `${Math.round(Math.abs(s) * 100)} %`;
/** «+250» / «−0,3» (con el signo menos de verdad). */
const signed = (n: number, fmt: (v: number) => string) =>
  n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : fmt(0);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dayCount = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

/** «10 nov» o «10 nov 2026». */
export function dateText(key: string, withYear = false): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

const dayTitle = (key: string) =>
  `${cap(WEEKDAYS[weekdayOf(key) - 1])} ${dateText(key)}`;
const macros = (t: { protein: number; fat: number; carbs: number }) =>
  `P ${n0(t.protein)} g · G ${n0(t.fat)} g · C ${n0(t.carbs)} g`;

function instantText(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function topLines(list: TopItem[], unit: (n: number) => string): string[] {
  return list.map(
    (t, i) =>
      `${i + 1}. ${t.name}: ${t.times} ${t.times === 1 ? 'vez' : 'veces'} · ${unit(t.amount)} (${pct(t.share)})`,
  );
}

export function renderAssistantMarkdown(r: AssistantReport): string {
  const out: string[] = [];
  const line = (s = '') => out.push(s);
  const section = (title: string) => {
    line();
    line(`## ${title}`);
  };
  const { period, summary: s } = r;
  const sameYear = period.from.slice(0, 4) === period.to.slice(0, 4);
  const generated = new Date(r.generatedAt).toLocaleString('es-CO', {
    timeZone: TIME_ZONE,
    dateStyle: 'long',
    timeStyle: 'short',
  });

  line(
    `# Informe de NutriFer: ${dateText(period.from, !sameYear)} al ${dateText(period.to, true)}`,
  );
  line();
  line(
    `${period.days} ${period.days === 1 ? 'día' : 'días'}. Generado el ${generated} (hora de Colombia).`,
  );

  section('Perfil y metas');
  if (!r.profile || !r.targets)
    line('- Aún no tiene perfil ni meta en NutriFer.');
  else {
    const p = r.profile;
    const t = r.targets;
    const weight =
      p.trendWeightKg != null
        ? `peso de tendencia ${n1(p.trendWeightKg)} kg (en el perfil: ${n1(p.profileWeightKg)} kg)`
        : `peso ${n1(p.profileWeightKg)} kg`;
    line(
      `- ${cap(p.sex)} de ${p.age} años · ${n0(p.heightCm)} cm · ${weight}.`,
    );
    line(
      `- Objetivo: ${p.goal === 'mantener' ? 'mantener el peso' : `${p.goal} ${n1(p.ratePerWeekKg)} kg por semana`}. Actividad: ${p.activity.label.toLowerCase()} (× ${nf3.format(p.activity.factor)}).`,
    );
    line(
      `- Meta diaria: ${kc(t.kcal)} · proteína ${n0(t.protein)} g · grasa ${n0(t.fat)} g · carbohidratos ${n0(t.carbs)} g.`,
    );
    line(
      `- Fibra mínimo ${n0(t.fiberMin)} g · azúcares máximo ${n0(t.sugarMax)} g · sodio máximo ${n0(t.sodiumMax)} mg · agua ${n0(t.waterMl)} ml.`,
    );
    line(
      `- ${p.manualTargets ? 'Las metas las puso a mano: no se recalculan.' : p.adaptiveGoal ? 'La meta se ajusta sola cada lunes con el peso y lo comido.' : 'La meta sale de la fórmula (Mifflin-St Jeor × actividad) y no se ajusta sola.'}`,
    );
  }

  section('Resumen');
  const missing = [
    s.incompleteDays.length
      ? `a medias (no cuentan): ${s.incompleteDays.map((d) => dateText(d)).join(', ')}`
      : '',
    s.emptyDays.length
      ? `sin anotar: ${s.emptyDays.map((d) => dateText(d)).join(', ')}`
      : '',
  ].filter(Boolean);
  line(
    `- Días anotados: ${s.loggedDays} de ${period.days} · completos: ${s.completeDays}${missing.length ? ` · ${missing.join(' · ')}` : ''}.`,
  );
  if (s.avg) {
    const vs = s.vsTarget
      ? ` (${signed(s.vsTarget.kcal, n0)} kcal: ${pct(s.vsTarget.share)} ${s.vsTarget.kcal >= 0 ? 'sobre' : 'bajo'} la meta)`
      : '';
    const perKg =
      s.proteinPerKg != null ? ` (${n1(s.proteinPerKg)} g por kilo)` : '';
    line(
      `- Promedio de los días completos: ${kc(s.avg.kcal)}${vs} · proteína ${n0(s.avg.protein)} g${perKg} · grasa ${n0(s.avg.fat)} g · carbohidratos ${n0(s.avg.carbs)} g · fibra ${n0(s.avg.fiber)} g · azúcares ${n0(s.avg.sugar)} g · sodio ${n0(s.avg.sodium)} mg.`,
    );
    if (s.sugarKnownShare < 0.8) {
      line(
        `- Ojo con los azúcares: solo se conocen en el ${pct(s.sugarKnownShare)} de lo comido (la tabla del ICBF no los trae), así que el total real es mayor.`,
      );
    }
    if (s.quickShare >= 0.05) {
      line(
        `- El ${pct(s.quickShare)} de las calorías son registros rápidos (solo calorías): de esos no se sabe la proteína, la grasa, los carbohidratos ni el sodio.`,
      );
    }
    if (s.macroSplit) {
      const rest =
        1 - s.macroSplit.protein - s.macroSplit.fat - s.macroSplit.carbs;
      line(
        `- De dónde salen las calorías: proteína ${pct(s.macroSplit.protein)} · grasa ${pct(s.macroSplit.fat)} · carbohidratos ${pct(s.macroSplit.carbs)}${rest >= 0.03 ? ` · sin desglose ${pct(rest)} (registros rápidos o alcohol)` : ''}.`,
      );
    }
    if (s.daysInTarget != null)
      line(
        `- En la meta (±10 %): ${s.daysInTarget} de ${s.completeDays} días · por encima: ${s.daysOver} · por debajo: ${s.daysUnder}.`,
      );
    if (s.proteinDays != null) {
      line(
        `- Días con la proteína completa (90 % o más): ${s.proteinDays} · con fibra suficiente: ${s.fiberDays} · con azúcares de más: ${s.sugarOverDays} · con sodio de más: ${s.sodiumOverDays}.`,
      );
    }
    if (s.weekdayAvgKcal != null || s.weekendAvgKcal != null) {
      line(
        `- Entre semana: ${s.weekdayAvgKcal != null ? kc(s.weekdayAvgKcal) : 'sin días completos'} · fin de semana: ${s.weekendAvgKcal != null ? kc(s.weekendAvgKcal) : 'sin días completos'} (promedios).`,
      );
    }
  } else line('- No hay días completos para sacar promedios.');
  line(
    `- Agua: ${s.water.avgMl != null ? `${n0(s.water.avgMl)} ml en promedio (${dayCount(s.water.daysLogged)} con agua anotada)${s.water.daysAtGoal != null ? ` · meta cumplida ${dayCount(s.water.daysAtGoal)}` : ''}` : 'sin anotar'}.`,
  );

  if (s.completeDays > 0) {
    section('Por comida (días completos)');
    line('| Comida | Promedio al día | Del total | Días que la comió |');
    line('|---|---:|---:|---:|');
    for (const m of r.meals)
      line(
        `| ${m.name} | ${kc(m.avgKcal)} | ${pct(m.share)} | ${m.daysEaten} de ${s.completeDays} |`,
      );
  }

  if (r.groups.length) {
    section('Por grupo de alimentos');
    line(r.groups.map((g) => `${g.name} ${pct(g.share)}`).join(' · '));
  }

  if (r.top.kcal.length) {
    section('Lo que más calorías aportó');
    topLines(r.top.kcal, kc).forEach((l) => line(l));
  }
  if (r.top.protein.length) {
    section('De dónde sale la proteína');
    topLines(r.top.protein, (n) => `${n1(n)} g`).forEach((l) => line(l));
  }
  if (r.top.sugar.length) {
    section('Lo que más azúcares aportó');
    topLines(r.top.sugar, (n) => `${n1(n)} g`).forEach((l) => line(l));
  }
  if (r.top.sodium.length) {
    section('Lo que más sodio aportó');
    topLines(r.top.sodium, (n) => `${n0(n)} mg`).forEach((l) => line(l));
  }

  section('Peso');
  if (!r.weight) line('- Sin pesadas.');
  else {
    const w = r.weight;
    line(
      `- Última pesada: ${n1(w.lastKg)} kg (${dateText(w.lastDate)}) · tendencia ${n1(w.trendKg)} kg.`,
    );
    const changes = [
      w.change7 != null ? `en 7 días ${signed(w.change7, n1)} kg` : '',
      w.change30 != null ? `en 30 días ${signed(w.change30, n1)} kg` : '',
      w.weeklyRate != null
        ? `ritmo ${signed(w.weeklyRate, n1)} kg por semana`
        : '',
    ].filter(Boolean);
    if (changes.length)
      line(`- Cambio de la tendencia: ${changes.join(' · ')}.`);
    line(
      `- Pesadas del periodo: ${w.inPeriod.length ? w.inPeriod.map((p) => `${dateText(p.date)} ${n1(p.kg)} kg`).join(' · ') : 'ninguna'}.`,
    );
  }

  if (r.energy) {
    const e = r.energy;
    section('Gasto real');
    if (e.status === 'ready' && e.observedKcal != null) {
      line(
        `- Con la fórmula: ${kc(e.formulaKcal)} al día. Observado con el peso y lo comido: ${kc(e.observedKcal)} (${e.loggedDays} días medidos en ${e.spanDays}; confianza ${pct(e.confidence)}). Se usa: ${kc(e.usedKcal)}.`,
      );
    } else {
      line(
        `- Con la fórmula: ${kc(e.formulaKcal)} al día. El gasto observado aún se está midiendo (faltan unos ${e.missingDays} días con la comida completa).`,
      );
    }
    if (e.reviews.length) {
      line(
        `- Revisiones de la meta: ${e.reviews.map((h) => `${dateText(h.weekStart)} ${n0(h.kcalBefore)} → ${kc(h.kcalTarget)}`).join(' · ')}.`,
      );
    }
    line(`- Próxima revisión: ${dayTitle(e.nextReview).toLowerCase()}.`);
  }

  if (r.fasting) {
    const f = r.fasting;
    section('Ayuno');
    line(
      `- Meta ${f.goalHours} h · racha ${f.streak} · mejor racha ${f.best}.${f.current ? ` En curso desde el ${instantText(f.current.startedAt)} (${n1(f.current.hours)} h).` : ''}`,
    );
    if (f.recent.length) {
      line(
        `- Del periodo: ${f.recent.map((x) => `${instantText(x.startedAt)}: ${n1(x.hours)} h (${x.reached ? 'llegó' : 'no llegó'})`).join(' · ')}.`,
      );
    }
  }

  if (r.discoveries.length) {
    section('Descubrimientos (últimas 4 semanas)');
    for (const d of r.discoveries)
      line(`- ${d.text}${d.detail ? ` (${d.detail})` : ''}`);
  }

  section('Día por día (del más reciente al más antiguo)');
  for (const d of [...r.days].reverse()) {
    line();
    const tag =
      d.status === 'today'
        ? ' · hoy, aún no termina'
        : d.status === 'incomplete'
          ? ' · a medias'
          : d.status === 'empty'
            ? ' · sin anotar'
            : '';
    line(
      `### ${dayTitle(d.date)}${tag}${d.meals.length ? ` · ${kc(d.totals.kcal)}` : ''}`,
    );
    const extra = [
      d.waterMl > 0 ? `agua ${n0(d.waterMl)} ml` : '',
      d.weightKg != null ? `peso ${n1(d.weightKg)} kg` : '',
    ].filter(Boolean);
    if (d.meals.length) {
      line(
        [
          macros(d.totals),
          `fibra ${n0(d.totals.fiber)} g`,
          `azúcares ${n0(d.totals.sugar)} g`,
          `sodio ${n0(d.totals.sodium)} mg`,
          ...extra,
        ].join(' · '),
      );
    } else if (extra.length) line(cap(extra.join(' · ')));
    for (const m of d.meals) {
      line(`- **${m.name}** · ${kc(m.kcal)}`);
      for (const it of m.items) {
        const name = it.brand ? `${it.name} (${it.brand})` : it.name;
        const known = !it.quick || it.protein + it.fat + it.carbs > 0;
        line(
          `  - ${name}${it.amount ? `: ${it.amount}` : ''} → ${kc(it.kcal)}${known ? ` · ${macros(it)}` : ''}`,
        );
      }
    }
  }

  section('Cómo leer este informe');
  for (const n of r.notes) line(`- ${n}`);
  return `${out.join('\n')}\n`;
}
