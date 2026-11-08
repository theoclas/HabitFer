import { fastState, fastStreaks, reachedByDay } from './fasting/fasting';
import { autoValue, type DayFacts } from './habits/auto-values';
import { buyText, shoppingList } from './plan/shopping';
import { buildDays } from './progress/report';
import { monthDays, monthSummary } from './progress/month';
import { weightTrend } from './progress/trend';

const facts = (f: Partial<DayFacts> = {}): DayFacts => ({
  mealsLogged: 0,
  protein: 0,
  proteinTarget: 120,
  waterMl: 0,
  waterGoalMl: 2000,
  glassMl: 250,
  fastHours: 0,
  ...f,
});

describe('hábitos que NutriFer marca solos', () => {
  it('anotar las comidas: en sí o no hacen falta 3; medible cuenta las comidas', () => {
    expect(autoValue('NUTRI_LOG', 1, facts({ mealsLogged: 2 }))).toBe(0);
    expect(autoValue('NUTRI_LOG', 1, facts({ mealsLogged: 3 }))).toBe(1);
    expect(autoValue('NUTRI_LOG', 3, facts({ mealsLogged: 2 }))).toBe(2);
  });

  it('proteína: desde el 90 % de la meta; sin meta no se marca', () => {
    expect(autoValue('NUTRI_PROTEIN', 1, facts({ protein: 107 }))).toBe(0);
    expect(autoValue('NUTRI_PROTEIN', 1, facts({ protein: 108 }))).toBe(1);
    expect(autoValue('NUTRI_PROTEIN', 1, facts({ protein: 150, proteinTarget: null }))).toBe(0);
    expect(autoValue('NUTRI_PROTEIN', 120, facts({ protein: 96.6 }))).toBe(97);
  });

  it('agua: vasos enteros en el medible; la meta en el de sí o no', () => {
    expect(autoValue('NUTRI_WATER', 8, facts({ waterMl: 1100 }))).toBe(4);
    expect(autoValue('NUTRI_WATER', 1, facts({ waterMl: 1999 }))).toBe(0);
    expect(autoValue('NUTRI_WATER', 1, facts({ waterMl: 2000 }))).toBe(1);
  });

  it('ayuno: hecho si uno llegó a su meta; medible en horas', () => {
    expect(autoValue('NUTRI_FAST', 1, facts({ fastHours: 0 }))).toBe(0);
    expect(autoValue('NUTRI_FAST', 1, facts({ fastHours: 16.2 }))).toBe(1);
    expect(autoValue('NUTRI_FAST', 16, facts({ fastHours: 16.9 }))).toBe(16);
  });
});

describe('ayuno', () => {
  const at = (iso: string) => new Date(iso);
  const fast = (id: string, start: string, end: string | null, goal = 16) => ({ id, startedAt: at(start), endedAt: end ? at(end) : null, goalHours: goal });

  it('cuánto lleva y si llegó a la meta', () => {
    const s = fastState(fast('a', '2026-11-08T20:00:00-05:00', null), at('2026-11-09T10:00:00-05:00'));
    expect(s.hours).toBe(14);
    expect(s.reached).toBe(false);
    expect(s.goalAt.toISOString()).toBe(at('2026-11-09T12:00:00-05:00').toISOString());
  });

  it('racha: días seguidos con un ayuno que llegó a su meta (hoy aún puede llegar)', () => {
    const now = at('2026-11-09T09:00:00-05:00');
    const list = [
      fast('1', '2026-11-05T20:00:00-05:00', '2026-11-06T13:00:00-05:00'),
      fast('2', '2026-11-06T20:00:00-05:00', '2026-11-07T13:00:00-05:00'),
      fast('3', '2026-11-07T20:00:00-05:00', '2026-11-08T12:30:00-05:00'),
      fast('4', '2026-11-08T21:00:00-05:00', null), // en curso: aún no llega
      fast('5', '2026-11-01T20:00:00-05:00', '2026-11-02T08:00:00-05:00'), // 12 h de 16: no cuenta
    ];
    expect(fastStreaks(list, now)).toEqual({ current: 3, best: 3 });
    expect(reachedByDay(list, now).get('2026-11-08')).toBeCloseTo(16.5, 5);
  });

  it('cortar la racha', () => {
    const now = at('2026-11-12T09:00:00-05:00');
    const list = [fast('1', '2026-11-05T20:00:00-05:00', '2026-11-06T13:00:00-05:00'), fast('2', '2026-11-06T20:00:00-05:00', '2026-11-07T13:00:00-05:00')];
    expect(fastStreaks(list, now)).toEqual({ current: 0, best: 2 });
  });
});

describe('lista de mercado', () => {
  it('cómo comprar: unidades, libras y lo cocido en crudo', () => {
    expect(buyText('Huevo de gallina, entero', 300, { label: 'Unidad', grams: 50 })).toBe('6 unidades (300 g)');
    expect(buyText('Banano común, crudo', 300, { label: '1 unidad mediana', grams: 120 })).toBe('2½ unidades (300 g)');
    expect(buyText('Arroz blanco, pulido, cocido, sin sal', 900, { label: 'Pocillo', grams: 150 })).toBe('900 g cocido ≈ 360 g en crudo');
    expect(buyText('Res, churrasco, crudo', 1200, { label: 'Porción', grams: 120 })).toBe('1,2 kg (≈ 2½ libras)');
    expect(buyText('Queso campesino', 150, { label: 'Tajada', grams: 30 })).toBe('5 unidades (150 g)');
    expect(buyText('Aceite de girasol', 30, null)).toBe('30 g');
  });

  it('suma por alimento y agrupa por categoría', () => {
    const groups = shoppingList([
      { foodId: 'h', name: 'Huevo', category: 'Huevos', grams: 100, unit: { label: 'Unidad', grams: 50 } },
      { foodId: 'h', name: 'Huevo', category: 'Huevos', grams: 100, unit: { label: 'Unidad', grams: 50 } },
      { foodId: 'a', name: 'Arepa de maíz', category: 'Cereales', grams: 112, unit: { label: 'Arepa pequeña', grams: 56 } },
      { foodId: 'x', name: 'Sal', category: null, grams: 5, unit: null },
    ]);
    expect(groups.map((g) => g.category)).toEqual(['Cereales', 'Huevos', 'Otros']);
    expect(groups[1].items[0]).toMatchObject({ grams: 200, uses: 2, amount: '4 unidades (200 g)' });
  });

  it('junta el mismo producto aunque sean dos alimentos de la tabla (no lo cocido con lo crudo)', () => {
    const groups = shoppingList([
      { foodId: 'h1', name: 'Huevo de gallina, entero, crudo', category: 'Huevos', grams: 100, unit: { label: 'Unidad', grams: 50 } },
      { foodId: 'h2', name: 'Huevo de gallina, frito', category: 'Huevos', grams: 60, unit: { label: 'Unidad', grams: 60 } },
      { foodId: 'a1', name: 'Arroz blanco, cocido', category: 'Cereales', grams: 300, unit: null },
      { foodId: 'a2', name: 'Arroz blanco, crudo', category: 'Cereales', grams: 100, unit: null },
    ]);
    const eggs = groups.find((g) => g.category === 'Huevos')!.items;
    expect(eggs).toHaveLength(1);
    expect(eggs[0]).toMatchObject({ grams: 160, uses: 2 });
    expect(groups.find((g) => g.category === 'Cereales')!.items).toHaveLength(2);
  });
});

describe('tu mes en comida', () => {
  it('los días de un mes (hasta hoy si no ha terminado)', () => {
    expect(monthDays('2026-11', '2026-11-08')).toEqual({ from: '2026-11-01', to: '2026-11-08' });
    expect(monthDays('2026-10', '2026-11-08')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthDays('2026-02', '2026-11-08')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('lo más repetido, la mejor semana, la racha y el peso', () => {
    const entries = [
      { date: '2026-11-02', meal: 'ALMUERZO' as const, foodId: 'bandeja', name: 'Bandeja paisa', kcal: 1900, protein: 60, fat: 80, carbs: 150, fiber: 10, sugar: null, sodium: 2000 },
      { date: '2026-11-03', meal: 'ALMUERZO' as const, foodId: 'arroz', name: 'Arroz blanco', kcal: 2000, protein: 120, fat: 50, carbs: 300, fiber: 3, sugar: null, sodium: 10 },
      { date: '2026-11-04', meal: 'ALMUERZO' as const, foodId: 'arroz', name: 'Arroz blanco', kcal: 2050, protein: 120, fat: 50, carbs: 300, fiber: 3, sugar: null, sodium: 10 },
      { date: '2026-11-05', meal: 'ALMUERZO' as const, foodId: 'bandeja', name: 'Bandeja paisa', kcal: 1000, protein: 40, fat: 50, carbs: 80, fiber: 5, sugar: null, sodium: 900 },
      { date: '2026-11-10', meal: 'ALMUERZO' as const, foodId: 'arroz', name: 'Arroz blanco', kcal: 1950, protein: 110, fat: 50, carbs: 300, fiber: 3, sugar: null, sodium: 10 },
    ];
    const days = buildDays(entries, '2026-11-01', '2026-11-12');
    const trend = weightTrend([
      { date: '2026-10-30', kg: 80 },
      { date: '2026-11-10', kg: 79 },
    ]);
    const s = monthSummary({
      month: '2026-11',
      days,
      entries: entries.map((e) => ({ date: e.date, foodId: e.foodId, name: e.name, kcal: e.kcal, isDish: e.foodId === 'bandeja' })),
      targets: { kcal: 2000, protein: 120, fiber: 28, sugar: 50, sodium: 2000 },
      trend,
      water: [{ date: '2026-11-02', ml: 2000 }],
      waterGoalMl: 2000,
      fastsReached: 2,
      longestFastHours: 17.25,
    });
    expect(s.loggedDays).toBe(5);
    expect(s.inTarget).toBe(4);
    expect(s.proteinDays).toBe(3);
    expect(s.topFood).toMatchObject({ name: 'Arroz blanco', times: 3, days: 3 });
    expect(s.topDish).toMatchObject({ name: 'Bandeja paisa', times: 2 });
    expect(s.bestWeek).toMatchObject({ start: '2026-11-02', end: '2026-11-08', inTarget: 3, logged: 4 });
    expect(s.streak).toBe(4);
    expect(s.waterDays).toBe(1);
    expect(s.weight?.start).toBe(80);
    expect(s.weight?.change).toBeLessThan(0);
    expect(s.fasts).toEqual({ reached: 2, longestHours: 17.3 });
  });
});
