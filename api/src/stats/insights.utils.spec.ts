import { HabitKind, ScheduleType } from '@prisma/client';
import { shiftKey } from '../habits/habit-rules';
import type { HistoryHabit } from './history.utils';
import { computeInsights } from './insights.utils';

const TODAY = '2026-11-08'; // domingo

function habit(id: string, startKey: string, done: string[], over: Partial<HistoryHabit> & { hour?: number | null } = {}): HistoryHabit {
  const { hour = 20, ...rest } = over;
  return {
    id,
    title: id,
    icon: null,
    color: '#FF7A1A',
    kind: HabitKind.BUILD,
    scheduleType: ScheduleType.DAILY,
    scheduleDays: [1, 2, 3, 4, 5, 6, 7],
    weeklyTarget: null,
    streakEnabled: true,
    goal: 1,
    unit: null,
    createdKey: startKey,
    startKey,
    completions: done.map((key) => ({ key, hour })),
    doneKeys: new Set(done),
    skipKeys: new Set(),
    ...rest,
  };
}

/** Dias entre dos claves (ambas incluidas) que cumplen el filtro. */
function daysBetween(from: string, to: string, keep: (key: string, i: number) => boolean = () => true): string[] {
  const out: string[] = [];
  for (let key = from, i = 0; key <= to; key = shiftKey(key, 1), i++) if (keep(key, i)) out.push(key);
  return out;
}

const isMonday = (key: string) => new Date(key + 'T12:00:00Z').getUTCDay() === 1;
const ids = (list: ReturnType<typeof computeInsights>) => list.map((i) => i.id);

describe('computeInsights', () => {
  it('encuentra el dia de la semana en que mas cuesta un habito', () => {
    const h = habit('Leer', '2026-09-01', daysBetween('2026-09-01', '2026-11-07', (k) => !isMonday(k)));
    const res = computeInsights([h], new Map(), TODAY, 20);
    const weak = res.find((i) => i.id === 'weekday-weak:Leer');
    expect(weak).toMatchObject({ tone: 'tip', title: 'Los lunes te cuesta «Leer»' });
    expect(weak?.text).toContain('el 0 %');
  });

  it('nota si la semana va mejor que la anterior', () => {
    const done = [...daysBetween('2026-11-01', '2026-11-07'), '2026-10-25', '2026-10-27', '2026-10-29'];
    const res = computeInsights([habit('Agua', '2026-10-20', done)], new Map(), TODAY, 20);
    expect(ids(res)).toContain('trend-up');
  });

  it('avisa de una medalla a un dia', () => {
    // Racha de 9 dias que termina ayer: la siguiente medalla es la de 10.
    const res = computeInsights([habit('Meditar', '2026-10-30', daysBetween('2026-10-30', '2026-11-07'))], new Map(), TODAY, 20);
    expect(res.find((i) => i.id === 'milestone-near:Meditar')).toMatchObject({ title: 'Te falta 1 día para una medalla' });
  });

  it('señala un habito abandonado', () => {
    const res = computeInsights([habit('Gimnasio', '2026-10-01', daysBetween('2026-10-01', '2026-10-15'))], new Map(), TODAY, 20);
    const n = res.find((i) => i.id === 'neglected:Gimnasio');
    expect(n?.title).toBe('«Gimnasio» lleva 23 días sin marcarse');
  });

  it('celebra un record al dejar algo, o lo cerca que esta', () => {
    const record = habit('No fumar', shiftKey(TODAY, -60), [], { kind: HabitKind.QUIT, doneKeys: new Set([shiftKey(TODAY, -50)]) });
    expect(ids(computeInsights([record], new Map(), TODAY, 20))).toContain('quit-record:No fumar');
    const near = habit('Sin azúcar', shiftKey(TODAY, -60), [], { kind: HabitKind.QUIT, doneKeys: new Set([shiftKey(TODAY, -30)]) });
    expect(computeInsights([near], new Map(), TODAY, 20).find((i) => i.id === 'quit-near:Sin azúcar')?.title).toBe('Estás a 1 día de tu récord');
  });

  it('detecta si eres de manana', () => {
    const h = habit('Despertar', '2026-10-01', daysBetween('2026-10-15', '2026-11-07'), { hour: 6 });
    expect(ids(computeInsights([h], new Map(), TODAY, 20))).toContain('hour-early');
  });

  it('sin historial no dice nada y respeta el limite', () => {
    expect(computeInsights([], new Map(), TODAY)).toEqual([]);
    const many = [
      habit('Leer', '2026-09-01', daysBetween('2026-09-01', '2026-11-07', (k) => !isMonday(k)), { hour: 6 }),
      habit('Gimnasio', '2026-10-01', daysBetween('2026-10-01', '2026-10-15')),
    ];
    const res = computeInsights(many, new Map(), TODAY, 2);
    expect(res).toHaveLength(2);
    expect(res[0].score).toBeGreaterThanOrEqual(res[1].score);
  });
});
