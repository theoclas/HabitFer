import { computeTargets } from '../nutrition-math';
import { DEFAULT_MEAL_NAMES } from '../meals';
import { eachDay, mondayOf, shiftKey } from './days';
import { discoveries } from './discoveries';
import { estimateExpenditure, weightSlope, type DayIntake } from './expenditure';
import { nutrientGoals } from './goals';
import { buildDays, mealShares, summarize, topFoods, type ReportEntry } from './report';
import { trendAt, trendSummary, weightTrend } from './trend';
import { parseWeighDate, parseWeight } from './weight-parse';

const TODAY = '2026-11-30';

/** Días seguidos que terminan ayer. */
const lastDays = (n: number) => Array.from({ length: n }, (_, i) => shiftKey(TODAY, -n + i));

describe('fechas', () => {
  it('lunes de la semana y días seguidos', () => {
    expect(mondayOf('2026-11-08')).toBe('2026-11-02'); // domingo
    expect(mondayOf('2026-11-09')).toBe('2026-11-09'); // lunes
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
});

describe('tendencia del peso', () => {
  it('empieza en la primera pesada y se mueve un 10 % por día', () => {
    const t = weightTrend([
      { date: '2026-11-01', kg: 80 },
      { date: '2026-11-02', kg: 81 },
    ]);
    expect(t[0].trend).toBe(80);
    expect(t[1].trend).toBeCloseTo(80.1, 5);
  });

  it('si pasan días sin pesarse, el peso nuevo cuenta más (1 − 0,9ⁿ)', () => {
    const t = weightTrend([
      { date: '2026-11-01', kg: 80 },
      { date: '2026-11-04', kg: 79 },
    ]);
    expect(t[1].trend).toBeCloseTo(80 - (1 - 0.9 ** 3), 5);
  });

  it('un salto de un día casi no la mueve', () => {
    const points = lastDays(10).map((date, i) => ({ date, kg: i === 9 ? 82 : 80 }));
    const t = weightTrend(points);
    expect(t[t.length - 1].kg).toBe(82);
    expect(t[t.length - 1].trend).toBeCloseTo(80.2, 5);
  });

  it('resumen: cambio en 7 días y ritmo semanal', () => {
    const points = lastDays(29).map((date, i) => ({ date, kg: 80 - i * 0.05 }));
    const s = trendSummary(weightTrend(points))!;
    expect(s.last.date).toBe(shiftKey(TODAY, -1));
    expect(s.change7).toBeLessThan(0);
    expect(s.weeklyRate).toBeLessThan(0);
    expect(trendAt(weightTrend(points), '2020-01-01')).toBeNull();
    expect(trendSummary([])).toBeNull();
  });
});

describe('gasto real (meta que se ajusta sola)', () => {
  const intake = (days: string[], kcal: number): DayIntake[] => days.map((date) => ({ date, kcal, entries: 4 }));

  it('pendiente de la recta: no se deja llevar por un día con agua', () => {
    const points = lastDays(15).map((date, i) => ({ date, kg: 80 - i * 0.1 + (i === 7 ? 1.5 : 0) }));
    expect(weightSlope(points)).toBeCloseTo(-0.1, 1);
    expect(weightSlope([{ date: TODAY, kg: 80 }])).toBeNull();
  });

  it('sin pesadas: sigue con la fórmula y dice cuánto falta', () => {
    const e = estimateExpenditure({ today: TODAY, intake: intake(lastDays(20), 2100), weights: [], formulaTdee: 2213, previousTdee: null });
    expect(e.status).toBe('collecting');
    expect(e.tdee).toBe(2210);
    expect(e.missingDays).toBe(14);
    expect(e.needWeighIns).toBe(3);
    expect(e.observed).toBeNull();
  });

  it('con 4 semanas: comer 2.000 y bajar 1 kg ≈ gastar 2.285', () => {
    const days = lastDays(28);
    const weights = days.map((date, i) => ({ date, kg: 80 - i / 27 }));
    const e = estimateExpenditure({ today: TODAY, intake: intake(days, 2000), weights, formulaTdee: 2200, previousTdee: null });
    expect(e.status).toBe('ready');
    expect(e.spanDays).toBe(27);
    expect(e.loggedDays).toBe(27);
    expect(e.observed).toBe(2285);
    expect(e.trendChange).toBeCloseTo(-1, 2);
    expect(e.confidence).toBeCloseTo(0.95, 2);
    expect(e.tdee).toBe(2280);
  });

  it('nunca se mueve más de 150 kcal frente a la revisión anterior', () => {
    const days = lastDays(28);
    const weights = days.map((date, i) => ({ date, kg: 80 - (i * 2) / 27 }));
    const e = estimateExpenditure({ today: TODAY, intake: intake(days, 2000), weights, formulaTdee: 2200, previousTdee: 2200 });
    expect(e.observed).toBeGreaterThan(2500);
    expect(e.tdee).toBe(2350);
    // Y al volver a la fórmula por falta de datos, tampoco salta.
    const back = estimateExpenditure({ today: TODAY, intake: [], weights: [], formulaTdee: 2200, previousTdee: 2600 });
    expect(back.tdee).toBe(2450);
  });

  it('los días con muy poco anotado no cuentan (seguro faltó algo)', () => {
    const days = lastDays(28);
    const weights = days.map((date) => ({ date, kg: 80 }));
    const food = days.map((date, i) => ({ date, kcal: i % 2 ? 2200 : 400, entries: 2 }));
    const e = estimateExpenditure({ today: TODAY, intake: food, weights, formulaTdee: 2200, previousTdee: null });
    expect(e.loggedDays).toBe(13);
    expect(e.intakeAvg).toBe(2200);
  });

  it('con 2 semanas se mezcla con la fórmula', () => {
    const days = lastDays(15);
    const weights = days.map((date) => ({ date, kg: 80 }));
    const e = estimateExpenditure({ today: TODAY, intake: intake(days, 2600), weights, formulaTdee: 2200, previousTdee: null });
    expect(e.status).toBe('ready');
    expect(e.observed).toBe(2600);
    expect(e.confidence).toBeCloseTo(0.33, 2);
    expect(e.tdee).toBe(2330);
  });

  it('la meta sale del gasto medido con las mismas reglas', () => {
    const p = { sex: 'MALE' as const, birthYear: 1990, heightCm: 175, weightKg: 80, activity: 1.375, goal: 'LOSE' as const, ratePerWeek: 0.5 };
    const formula = computeTargets(p, 2026);
    const measured = computeTargets(p, 2026, 2500);
    expect(measured.tdee).toBe(2500);
    expect(measured.kcal).toBe(1950);
    expect(measured.protein).toBe(formula.protein);
  });
});

describe('metas de nutrientes', () => {
  it('fibra por cada 1.000 kcal, azúcares 10 % y sodio 2.000 mg', () => {
    expect(nutrientGoals(2000)).toEqual({ fiber: 28, sugar: 50, sodium: 2000 });
    expect(nutrientGoals(1500)).toEqual({ fiber: 25, sugar: 38, sodium: 2000 });
  });
});

const entry = (date: string, meal: ReportEntry['meal'], kcal: number, extra: Partial<ReportEntry> = {}): ReportEntry => ({
  date,
  meal,
  foodId: null,
  name: 'Algo',
  kcal,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: null,
  sugar: null,
  sodium: null,
  ...extra,
});

describe('informe', () => {
  const entries = [
    entry('2026-11-02', 'DESAYUNO', 400, { foodId: 'arepa', name: 'Arepa', protein: 10, fiber: 3, sodium: 300 }),
    entry('2026-11-02', 'ALMUERZO', 900, { foodId: 'arroz', name: 'Arroz blanco, cocido', protein: 15, sodium: 900 }),
    entry('2026-11-02', 'COMIDA', 700, { name: 'Empanada', sodium: 1200 }),
    entry('2026-11-03', 'ALMUERZO', 1100, { foodId: 'arroz', name: 'Arroz blanco, cocido', protein: 20 }),
    entry('2026-11-03', 'ONCES', 300, { name: 'empanada' }),
  ];
  const targets = { kcal: 2000, protein: 120, fiber: 28, sugar: 50, sodium: 2000 };

  it('un día por fecha, también los vacíos', () => {
    const days = buildDays(entries, '2026-11-02', '2026-11-04');
    expect(days.map((d) => d.kcal)).toEqual([2000, 1400, 0]);
    expect(days[0].meals).toEqual({ DESAYUNO: 400, MEDIAS_NUEVES: 0, ALMUERZO: 900, ONCES: 0, COMIDA: 700 });
    expect(days[0].breakfastProtein).toBe(10);
    expect(days[0].sodium).toBe(2400);
  });

  it('promedios de los días anotados, días en meta y por comida', () => {
    const days = buildDays(entries, '2026-11-02', '2026-11-08');
    const s = summarize(days, targets);
    expect(s.logged).toBe(2);
    expect(s.avg?.kcal).toBe(1700);
    expect(s.inTarget).toBe(1);
    expect(s.proteinDays).toBe(0);
    expect(s.sodiumOver).toBe(1);
    const shares = mealShares(days);
    expect(shares.find((m) => m.slot === 'ALMUERZO')).toEqual({ slot: 'ALMUERZO', kcal: 2000, share: 0.588 });
  });

  it('lo que más calorías aporta, junto aunque el nombre cambie de mayúsculas', () => {
    const top = topFoods(entries);
    expect(top[0]).toMatchObject({ foodId: 'arroz', kcal: 2000, times: 2 });
    expect(top[1]).toMatchObject({ name: 'Empanada', kcal: 1000, times: 2 });
  });
});

describe('descubrimientos', () => {
  const targets = { kcal: 2000, protein: 120, fiber: 28, sugar: 50, sodium: 2000 };

  it('sin datos suficientes no inventa nada', () => {
    const days = buildDays([entry('2026-11-02', 'ALMUERZO', 900)], '2026-11-02', '2026-11-08');
    expect(discoveries(days, targets, [], DEFAULT_MEAL_NAMES)).toEqual([]);
  });

  it('fines de semana, desayuno con proteína y la comida más grande', () => {
    const list: ReportEntry[] = [];
    for (const date of eachDay('2026-11-02', '2026-11-29')) {
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const weekend = weekday === 0 || weekday === 6;
      const protein = Number(date.slice(8)) % 2 === 0;
      list.push(entry(date, 'DESAYUNO', 400, { protein: protein ? 30 : 5 }));
      list.push(entry(date, 'ALMUERZO', weekend ? 1600 : 1000, { protein: 40, fiber: 5, sodium: 800 }));
      list.push(entry(date, 'COMIDA', protein ? 500 : 800, { protein: 30 }));
    }
    const days = buildDays(list, '2026-11-02', '2026-11-29');
    const found = discoveries(days, targets, topFoods(list), DEFAULT_MEAL_NAMES);
    const ids = found.map((d) => d.id);
    expect(ids).toContain('fin-de-semana');
    expect(found.find((d) => d.id === 'fin-de-semana')?.text).toMatch(/^Los fines de semana comes \d+ % más que entre semana\.$/);
    expect(found.find((d) => d.id === 'desayuno-proteina')).toMatchObject({ tone: 'good' });
    expect(found.find((d) => d.id === 'desayuno-proteina')?.text).toContain('comes 38 % menos en onces y comida');
    expect(found.find((d) => d.id === 'comida-grande')?.text).toMatch(/^Tu almuerzo es el \d+ % de lo que comes en el día\.$/);
    expect(ids).toContain('fibra');
    expect(found.length).toBeLessThanOrEqual(6);
  });
});

describe('peso desde el atajo de iOS', () => {
  it('entiende números y textos con unidad', () => {
    expect(parseWeight(72.5)).toBe(72.5);
    expect(parseWeight('72,5 kg')).toBe(72.5);
    expect(parseWeight('72.5')).toBe(72.5);
    expect(parseWeight('160 lb')).toBe(72.57);
    expect(parseWeight([71.2, 71.8])).toBe(71.2);
    expect(parseWeight('peso')).toBeNull();
    expect(parseWeight(12)).toBeNull();
    expect(parseWeight(null)).toBeNull();
  });

  it('la fecha: ISO a la hora de Colombia, sin fecha o en el futuro = hoy', () => {
    expect(parseWeighDate('2026-11-07', '2026-11-08')).toBe('2026-11-07');
    expect(parseWeighDate(undefined, '2026-11-08')).toBe('2026-11-08');
    expect(parseWeighDate('2026-11-09', '2026-11-08')).toBe('2026-11-08');
    expect(parseWeighDate('2026-02-30', '2026-11-08')).toBe('2026-11-08');
    expect(parseWeighDate('ayer', '2026-11-08')).toBe('2026-11-08');
  });
});
