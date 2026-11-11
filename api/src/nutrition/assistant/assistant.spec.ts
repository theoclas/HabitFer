import { BadRequestException } from '@nestjs/common';
import type { MealSlot } from '@prisma/client';
import { MEAL_ORDER, DEFAULT_MEAL_NAMES } from '../meals';
import {
  AGENT_KEY_PREFIX,
  bearerToken,
  cleanKeyName,
  hashAgentKey,
  newAgentKey,
} from './agent-keys';
import {
  buildAssistantReport,
  renderAssistantMarkdown,
  topBy,
  type AssistantEntry,
  type AssistantInput,
} from './assistant-report';
import { reportRange } from './assistant.service';

const entry = (
  date: string,
  meal: MealSlot,
  name: string,
  kcal: number,
  extra: Partial<AssistantEntry> = {},
): AssistantEntry => ({
  date,
  meal,
  foodId: `f-${name}`,
  name,
  portionLabel: null,
  quantity: 1,
  grams: 100,
  kcal,
  protein: kcal / 20,
  fat: kcal / 30,
  carbs: kcal / 10,
  fiber: 2,
  sugar: 5,
  sodium: 300,
  quick: false,
  prep: null,
  oilGrams: null,
  skipped: [],
  source: 'TCAC',
  category: 'Cereales y derivados',
  brand: null,
  ...extra,
});

// 3 al 10 nov 2026: el 10 es martes (hoy). Sábado 7 y domingo 8 son el fin de semana.
const base = (): AssistantInput => ({
  generatedAt: new Date('2026-11-10T20:00:00-05:00'),
  today: '2026-11-10',
  from: '2026-11-03',
  to: '2026-11-10',
  profile: {
    sex: 'MALE',
    birthYear: 1992,
    heightCm: 175,
    weightKg: 83,
    activity: 1.375,
    goal: 'LOSE',
    ratePerWeek: 0.5,
    manual: false,
    adaptive: true,
    kcalTarget: 2000,
    proteinTarget: 150,
    fatTarget: 67,
    carbsTarget: 200,
    waterGoalMl: 2000,
  },
  mealNames: { ...DEFAULT_MEAL_NAMES },
  entries: [
    entry('2026-11-03', 'DESAYUNO', 'Arepa de maíz', 300, {
      portionLabel: 'Arepa pequeña',
      quantity: 2,
      grams: 112,
    }),
    entry('2026-11-03', 'ALMUERZO', 'Bandeja paisa', 1100, {
      source: 'DISH',
      category: 'Platos típicos',
      skipped: ['Chicharrón'],
      portionLabel: 'Plato',
      grams: 600,
    }),
    entry('2026-11-03', 'COMIDA', 'Pollo asado', 700, {
      category: 'Carnes',
      prep: 'ASADO',
      oilGrams: 5,
      sodium: 900,
    }),
    entry('2026-11-04', 'ONCES', 'Galletas', 500, {
      source: 'OFF',
      category: null,
      brand: 'Ducales',
    }),
    entry('2026-11-07', 'ALMUERZO', 'Bandeja paisa', 1100, {
      source: 'DISH',
      category: 'Platos típicos',
    }),
    entry('2026-11-07', 'COMIDA', 'Pizza', 1500, {
      category: 'Comidas rápidas',
      sodium: 1900,
      sugar: 20,
    }),
    entry('2026-11-09', 'DESAYUNO', 'Arepa de maíz', 300),
    entry('2026-11-09', 'ALMUERZO', 'Registro rápido', 1200, {
      foodId: null,
      quick: true,
      grams: null,
      category: null,
      source: null,
      protein: 0,
      fat: 0,
      carbs: 0,
      fiber: null,
      sugar: null,
      sodium: null,
    }),
    entry('2026-11-10', 'DESAYUNO', 'Arepa de maíz', 400),
  ],
  water: [
    { date: '2026-11-03', ml: 2000 },
    { date: '2026-11-07', ml: 1000 },
    { date: '2026-11-10', ml: 500 },
  ],
  weights: [
    { date: '2026-11-03', kg: 83 },
    { date: '2026-11-09', kg: 82.5 },
  ],
  energy: null,
  fasting: { goalHours: 16, streak: 2, best: 5, current: null, history: [] },
  discoveries: [
    {
      text: 'Los fines de semana comes 30 % más.',
      detail: '2.600 kcal frente a 1.800',
      tone: 'watch',
    },
  ],
});

describe('informe para el asistente', () => {
  it('marca cada día: completo, a medias, vacío y hoy', () => {
    const r = buildAssistantReport(base());
    const status = Object.fromEntries(r.days.map((d) => [d.date, d.status]));
    expect(status).toEqual({
      '2026-11-03': 'complete',
      '2026-11-04': 'incomplete',
      '2026-11-05': 'empty',
      '2026-11-06': 'empty',
      '2026-11-07': 'complete',
      '2026-11-08': 'empty',
      '2026-11-09': 'complete',
      '2026-11-10': 'today',
    });
    expect(r.period).toEqual({
      from: '2026-11-03',
      to: '2026-11-10',
      days: 8,
      today: '2026-11-10',
      includesToday: true,
    });
    expect(r.summary.completeMinKcal).toBe(800);
    expect(r.summary.incompleteDays).toEqual(['2026-11-04']);
    expect(r.summary.emptyDays).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-08',
    ]);
    expect(r.summary.loggedDays).toBe(5);
  });

  it('saca los promedios solo de los días completos y los compara con la meta', () => {
    const { summary: s } = buildAssistantReport(base());
    expect(s.completeDays).toBe(3);
    // (2.100 + 2.600 + 1.500) / 3
    expect(s.avg?.kcal).toBe(2067);
    expect(s.vsTarget).toEqual({ kcal: 67, share: 0.034 });
    expect([s.daysInTarget, s.daysOver, s.daysUnder]).toEqual([1, 1, 1]);
    expect(s.weekdayAvgKcal).toBe(1800);
    expect(s.weekendAvgKcal).toBe(2600);
    // El agua de hoy no cuenta: 2.000 y 1.000.
    expect(s.water).toEqual({ avgMl: 1500, daysLogged: 2, daysAtGoal: 1 });
    expect(s.sodiumOverDays).toBe(1);
    expect(s.proteinPerKg).not.toBeNull();
  });

  it('avisa cuando faltan datos: azúcares del ICBF y registros rápidos', () => {
    const r = buildAssistantReport(base());
    // 1.200 de 6.200 kcal de los días completos son el registro rápido; nada trae el azúcar (todo es del ICBF).
    expect(r.summary.quickShare).toBe(0.194);
    expect(r.summary.sugarKnownShare).toBe(0);
    const md = renderAssistantMarkdown(r);
    expect(md).toContain(
      'Ojo con los azúcares: solo se conocen en el 0 % de lo comido',
    );
    expect(md).toContain('El 19 % de las calorías son registros rápidos');
    expect(md).toContain('  - Registro rápido: registro rápido → 1.200 kcal\n');

    const conAzucar = base();
    conAzucar.entries = conAzucar.entries.map((e) => ({
      ...e,
      source: 'USDA' as const,
      quick: false,
      sugar: 5,
    }));
    expect(buildAssistantReport(conAzucar).summary.sugarKnownShare).toBe(1);
    expect(
      renderAssistantMarkdown(buildAssistantReport(conAzucar)),
    ).not.toContain('Ojo con los azúcares');
  });

  it('reparte por comida y por grupo, y dice lo que más aportó', () => {
    const r = buildAssistantReport(base());
    const desayuno = r.meals.find((m) => m.slot === 'DESAYUNO')!;
    expect(desayuno.daysEaten).toBe(2);
    expect(desayuno.avgKcal).toBe(200);
    expect(r.meals.map((m) => m.slot)).toEqual(MEAL_ORDER);
    expect(r.top.kcal[0]).toMatchObject({
      name: 'Bandeja paisa',
      times: 2,
      amount: 2200,
    });
    expect(r.top.sodium[0].name).toBe('Pizza');
    expect(r.groups.map((g) => g.name)).toEqual(
      expect.arrayContaining([
        'Platos típicos',
        'Comidas rápidas',
        'Registros rápidos',
        'Empacados',
        'Cereales y derivados',
        'Carnes',
      ]),
    );
  });

  it('escribe la cantidad como en la app, con las partes que no se comió', () => {
    const r = buildAssistantReport(base());
    const day = r.days.find((d) => d.date === '2026-11-03')!;
    const items = day.meals.flatMap((m) => m.items);
    expect(items.map((i) => i.amount)).toEqual([
      '2 × arepa pequeña · 112 g',
      '1 plato · 600 g · sin chicharrón',
      '100 g · asado, +5 g de aceite',
    ]);
    const quick = r.days
      .find((d) => d.date === '2026-11-09')!
      .meals.find((m) => m.slot === 'ALMUERZO')!.items[0];
    expect(quick.amount).toBe('registro rápido');
  });

  it('trae el peso con su tendencia y el perfil en palabras', () => {
    const r = buildAssistantReport(base());
    expect(r.weight).toMatchObject({ lastDate: '2026-11-09', lastKg: 82.5 });
    expect(r.weight?.inPeriod).toHaveLength(2);
    expect(r.profile).toMatchObject({
      sex: 'hombre',
      age: 34,
      goal: 'bajar',
      activity: { factor: 1.375, label: 'Poco activo' },
    });
    expect(r.profile?.trendWeightKg).not.toBeNull();
    expect(r.targets).toMatchObject({
      kcal: 2000,
      fiberMin: 28,
      sugarMax: 50,
      sodiumMax: 2000,
    });
  });

  it('sin perfil no inventa metas', () => {
    const r = buildAssistantReport({ ...base(), profile: null });
    expect(r.targets).toBeNull();
    expect(r.profile).toBeNull();
    expect(r.summary.completeMinKcal).toBe(800);
    expect(r.summary.daysInTarget).toBeNull();
    expect(r.summary.vsTarget).toBeNull();
    expect(renderAssistantMarkdown(r)).toContain('Aún no tiene perfil ni meta');
  });

  it('sin ayunos no habla de ayuno', () => {
    expect(buildAssistantReport(base()).fasting).toBeNull();
  });

  it('el Markdown trae lo principal, del día más reciente al más antiguo', () => {
    const md = renderAssistantMarkdown(buildAssistantReport(base()));
    expect(md).toContain('# Informe de NutriFer: 3 nov al 10 nov 2026');
    expect(md).toContain('## Perfil y metas');
    expect(md).toContain('- Hombre de 34 años · 175 cm');
    expect(md).toContain('| Desayuno | 200 kcal |');
    expect(md).toContain('### Martes 10 nov · hoy, aún no termina · 400 kcal');
    expect(md).toContain('### Miércoles 4 nov · a medias · 500 kcal');
    expect(md).toContain('### Domingo 8 nov · sin anotar');
    expect(md).toContain('  - Galletas (Ducales): 100 g → 500 kcal');
    expect(md).toContain(
      '- Los fines de semana comes 30 % más. (2.600 kcal frente a 1.800)',
    );
    expect(md.indexOf('Martes 10 nov')).toBeLessThan(
      md.indexOf('Martes 3 nov'),
    );
    expect(md).toContain('## Cómo leer este informe');
  });

  it('topBy junta por alimento y los registros rápidos por nombre', () => {
    const list = [
      entry('2026-11-03', 'ONCES', 'Pan', 100, { foodId: null }),
      entry('2026-11-04', 'ONCES', 'pan', 50, { foodId: null }),
    ];
    expect(topBy(list, (e) => e.kcal, 5)).toEqual([
      { name: 'Pan', times: 2, amount: 150, share: 1 },
    ]);
  });
});

describe('periodo del informe', () => {
  it('por defecto son los últimos 14 días hasta hoy', () => {
    expect(reportRange({}, '2026-11-10')).toEqual({
      from: '2026-10-28',
      to: '2026-11-10',
    });
    expect(reportRange({ days: 7 }, '2026-11-10')).toEqual({
      from: '2026-11-04',
      to: '2026-11-10',
    });
  });

  it('no pasa de hoy y no deja periodos al revés ni de más de 92 días', () => {
    expect(
      reportRange({ from: '2026-11-01', to: '2026-12-31' }, '2026-11-10'),
    ).toEqual({ from: '2026-11-01', to: '2026-11-10' });
    expect(() =>
      reportRange({ from: '2026-11-09', to: '2026-11-02' }, '2026-11-10'),
    ).toThrow(BadRequestException);
    expect(() =>
      reportRange({ from: '2026-01-01', to: '2026-11-10' }, '2026-11-10'),
    ).toThrow(BadRequestException);
    expect(() => reportRange({ from: '2026-02-30' }, '2026-11-10')).toThrow(
      BadRequestException,
    );
  });
});

describe('llaves del asistente', () => {
  it('crea llaves distintas con su prefijo, huella y pista', () => {
    const a = newAgentKey();
    const b = newAgentKey();
    expect(a.token.startsWith(AGENT_KEY_PREFIX)).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashAgentKey(a.token));
    expect(a.tokenHash).toHaveLength(64);
    expect(a.hint).toBe(a.token.slice(-4));
  });

  it('lee la llave del encabezado Authorization', () => {
    expect(bearerToken('Bearer nfa_abc')).toBe('nfa_abc');
    expect(bearerToken('bearer   nfa_abc ')).toBe('nfa_abc');
    expect(bearerToken('nfa_abc')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });

  it('limpia el nombre', () => {
    expect(cleanKeyName('  Claude   en el PC ')).toBe('Claude en el PC');
    expect(cleanKeyName('')).toBe('Claude');
    expect(cleanKeyName(undefined)).toBe('Claude');
    expect(cleanKeyName('x'.repeat(80))).toHaveLength(60);
  });
});
