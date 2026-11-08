import { habitualSuggestions, previousMeals, type HistoryItem, type Slot } from './suggest.utils';

let n = 0;
const item = (date: string, meal: Slot, foodId: string | null, kcal = 10, extra: Partial<HistoryItem> = {}): HistoryItem => ({
  id: `e${++n}`,
  date,
  meal,
  foodId,
  quick: false,
  kcal,
  createdAt: new Date(`${date}T08:00:00Z`),
  ...extra,
});

const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `2026-11-${String(from + i).padStart(2, '0')}`);

describe('lo de siempre', () => {
  it('el tinto de todas las mañanas sale en el desayuno, con la última anotación', () => {
    const history = days(1, 7).map((d) => item(d, 'DESAYUNO', 'tinto'));
    const out = habitualSuggestions(history, []);
    const list = out.get('DESAYUNO') ?? [];
    expect(list).toHaveLength(1);
    expect(list[0].days).toBe(7);
    expect(list[0].template.date).toBe('2026-11-07');
    expect(out.get('ALMUERZO')).toBeUndefined();
  });

  it('algo de una o dos veces no es «de siempre»', () => {
    const history = [
      ...days(1, 7).map((d) => item(d, 'DESAYUNO', 'tinto')),
      item('2026-11-03', 'DESAYUNO', 'pandebono'),
      item('2026-11-05', 'DESAYUNO', 'pandebono'),
    ];
    expect((habitualSuggestions(history, []).get('DESAYUNO') ?? []).map((h) => h.template.foodId)).toEqual(['tinto']);
  });

  it('pide la mitad de los días con algo anotado (y 3 como mínimo)', () => {
    const history = [...days(1, 10).map((d) => item(d, 'ALMUERZO', 'arroz')), ...days(1, 4).map((d) => item(d, 'ALMUERZO', 'jugo'))];
    expect((habitualSuggestions(history, []).get('ALMUERZO') ?? []).map((h) => h.template.foodId)).toEqual(['arroz']);
    expect(habitualSuggestions(days(1, 2).map((d) => item(d, 'ONCES', 'fruta')), []).size).toBe(0);
  });

  it('no propone lo que ya está anotado en esa comida', () => {
    const history = days(1, 5).map((d) => item(d, 'DESAYUNO', 'tinto'));
    expect(habitualSuggestions(history, [{ meal: 'DESAYUNO', foodId: 'tinto' }]).size).toBe(0);
    expect(habitualSuggestions(history, [{ meal: 'ONCES', foodId: 'tinto' }]).get('DESAYUNO')).toHaveLength(1);
  });

  it('el registro rápido no cuenta', () => {
    const history = days(1, 5).map((d) => item(d, 'COMIDA', null, 500, { quick: true }));
    expect(habitualSuggestions(history, []).size).toBe(0);
  });

  it('máximo 3 por comida, los más frecuentes primero', () => {
    const history = ['a', 'b', 'c', 'd'].flatMap((f, i) => days(1, 7 - i).map((d) => item(d, 'DESAYUNO', f)));
    expect((habitualSuggestions(history, []).get('DESAYUNO') ?? []).map((h) => h.template.foodId)).toEqual(['a', 'b', 'c']);
  });
});

describe('repetir lo de ayer', () => {
  it('la última vez de cada comida y el último día', () => {
    const history = [
      item('2026-11-07', 'DESAYUNO', 'tinto', 20),
      item('2026-11-07', 'DESAYUNO', 'arepa', 150),
      item('2026-11-05', 'ALMUERZO', 'bandeja', 1100),
      item('2026-11-01', 'COMIDA', 'pan', 200),
    ];
    const { meals, day } = previousMeals(history, '2026-11-02');
    expect(meals.get('DESAYUNO')).toEqual({ date: '2026-11-07', count: 2, kcal: 170 });
    expect(meals.get('ALMUERZO')).toEqual({ date: '2026-11-05', count: 1, kcal: 1100 });
    expect(meals.get('COMIDA')).toBeUndefined();
    expect(day).toEqual({ date: '2026-11-07', count: 2, kcal: 170 });
  });

  it('sin nada reciente no hay qué repetir', () => {
    expect(previousMeals([item('2026-10-01', 'DESAYUNO', 'tinto')], '2026-11-01')).toEqual({ meals: new Map(), day: null });
  });
});
