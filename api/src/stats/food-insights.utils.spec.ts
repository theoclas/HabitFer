import { foodInsights, type FoodDay, type HabitDay } from './food-insights.utils';

const day = (i: number) => `2026-10-${String(i).padStart(2, '0')}`;

describe('descubrimientos de HabitFer con la comida', () => {
  it('anotar la comida y cumplir los hábitos', () => {
    const food: FoodDay[] = [];
    const habits: HabitDay[] = [];
    for (let i = 1; i <= 28; i++) {
      const logs = i % 2 === 0;
      if (logs) food.push({ date: day(i), meals: 3, kcal: 2000, protein: 100 });
      habits.push({ date: day(i), scheduled: 5, completed: logs ? 4 : 3 });
    }
    const out = foodInsights(food, habits, new Map(), null);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'food-habits', tone: 'good' });
    expect(out[0].text).toBe('Los días que anotas lo que comes en NutriFer cumples el 80 % de tus hábitos; los demás días, el 60 %.');
  });

  it('ánimo y proteína; y sin datos suficientes, nada', () => {
    const food: FoodDay[] = [];
    const moods = new Map<string, number>();
    for (let i = 1; i <= 20; i++) {
      const hit = i % 2 === 0;
      food.push({ date: day(i), meals: 3, kcal: 2000, protein: hit ? 130 : 60 });
      moods.set(day(i), hit ? 4.5 : 3.5);
    }
    const out = foodInsights(food, [], moods, { kcal: 2000, protein: 120 });
    expect(out.map((o) => o.id)).toEqual(['food-mood-protein']);
    expect(out[0].text).toBe('Tu ánimo promedio es 4,5 los días que llegas a la proteína y 3,5 cuando no.');
    expect(foodInsights(food.slice(0, 6), [], moods, { kcal: 2000, protein: 120 })).toEqual([]);
  });
});
