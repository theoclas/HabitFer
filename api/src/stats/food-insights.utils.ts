import type { Insight } from './insights.utils';

/** Lo de NutriFer de un día, para cruzarlo con los hábitos y el ánimo (sin IA). */
export type FoodDay = {
  date: string;
  /** Comidas con algo anotado. */
  meals: number;
  kcal: number;
  protein: number;
};

export type HabitDay = { date: string; scheduled: number; completed: number };

/** Mínimo de días en cada grupo para comparar. */
const MIN_DAYS = 7;
const pct = (n: number) => `${Math.round(n)} %`;
const one = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const avg = (list: number[]) => list.reduce((s, n) => s + n, 0) / list.length;

/**
 * Descubrimientos que cruzan la comida con los hábitos y el ánimo:
 * «los días que anotas lo que comes cumples el 82 % de tus hábitos», «tu ánimo es mejor los días que llegas a la
 * proteína». Los hábitos que NutriFer marca solos no cuentan (darían la respuesta por adelantado).
 */
export function foodInsights(
  food: FoodDay[],
  habits: HabitDay[],
  moods: Map<string, number>,
  targets: { kcal: number; protein: number } | null,
): Insight[] {
  const out: Insight[] = [];
  const foodBy = new Map(food.map((f) => [f.date, f]));
  const logged = (d: string) => (foodBy.get(d)?.meals ?? 0) >= 2;

  // 1. Anotar la comida y cumplir los hábitos.
  const withHabits = habits.filter((h) => h.scheduled > 0);
  const on = withHabits.filter((h) => logged(h.date));
  const off = withHabits.filter((h) => !logged(h.date));
  if (on.length >= MIN_DAYS && off.length >= MIN_DAYS) {
    const rate = (list: HabitDay[]) => (list.reduce((s, h) => s + h.completed, 0) / list.reduce((s, h) => s + h.scheduled, 0)) * 100;
    const a = rate(on);
    const b = rate(off);
    if (Math.abs(a - b) >= 10) {
      out.push({
        id: 'food-habits',
        emoji: '🍽️',
        title: a > b ? 'Anotar lo que comes te ordena el día' : 'Los días de anotar comida son más cargados',
        text: `Los días que anotas lo que comes en NutriFer cumples el ${pct(a)} de tus hábitos; los demás días, el ${pct(b)}.`,
        tone: a > b ? 'good' : 'info',
        score: 48 + Math.min(20, Math.round(Math.abs(a - b) / 2)),
      });
    }
  }

  if (targets && targets.protein > 0) {
    // 2. Ánimo y proteína.
    const moodDays = food.filter((f) => f.meals >= 2 && moods.has(f.date));
    const hit = moodDays.filter((f) => f.protein >= targets.protein * 0.9).map((f) => moods.get(f.date)!);
    const miss = moodDays.filter((f) => f.protein < targets.protein * 0.9).map((f) => moods.get(f.date)!);
    if (hit.length >= MIN_DAYS && miss.length >= MIN_DAYS) {
      const a = avg(hit);
      const b = avg(miss);
      if (Math.abs(a - b) >= 0.3) {
        out.push({
          id: 'food-mood-protein',
          emoji: '🍗',
          title: a > b ? 'La proteína te sube el ánimo' : 'La proteína y tu ánimo',
          text: `Tu ánimo promedio es ${one(a)} los días que llegas a la proteína y ${one(b)} cuando no.`,
          tone: a > b ? 'good' : 'info',
          score: 44 + Math.min(20, Math.round(Math.abs(a - b) * 10)),
        });
      }
    }

    // 3. Ánimo y comer de más.
    const over = moodDays.filter((f) => f.kcal > targets.kcal * 1.1).map((f) => moods.get(f.date)!);
    const fine = moodDays.filter((f) => f.kcal <= targets.kcal * 1.1).map((f) => moods.get(f.date)!);
    if (over.length >= MIN_DAYS && fine.length >= MIN_DAYS) {
      const a = avg(over);
      const b = avg(fine);
      if (b - a >= 0.3) {
        out.push({
          id: 'food-mood-over',
          emoji: '🫶',
          title: 'Comer de más y el ánimo van juntos',
          text: `Los días que te pasas de la meta de calorías tu ánimo promedio es ${one(a)}; los demás, ${one(b)}. A veces es al revés: el día pesado lleva a comer más.`,
          tone: 'tip',
          score: 40 + Math.min(20, Math.round((b - a) * 10)),
        });
      }
    }
  }
  return out;
}
