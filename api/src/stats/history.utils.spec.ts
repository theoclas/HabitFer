import { HabitKind, ScheduleType } from '@prisma/client';
import {
  buildDays,
  byHour,
  byWeekday,
  eachDayKey,
  moodSummary,
  pauseKeysFor,
  ranking,
  toHistoryHabit,
  type HistoryHabit,
} from './history.utils';

function habit(
  id: string,
  createdKey: string,
  done: [string, number | null][],
  days?: number[],
  over: Partial<HistoryHabit> = {},
): HistoryHabit {
  return {
    id,
    title: id,
    icon: null,
    color: '#FF7A1A',
    kind: HabitKind.BUILD,
    scheduleType: days ? ScheduleType.WEEKLY : ScheduleType.DAILY,
    scheduleDays: days ?? [1, 2, 3, 4, 5, 6, 7],
    weeklyTarget: null,
    streakEnabled: true,
    goal: 1,
    unit: null,
    createdKey,
    startKey: createdKey,
    completions: done.map(([key, hour]) => ({ key, hour })),
    doneKeys: new Set(done.map(([key]) => key)),
    skipKeys: new Set(),
    ...over,
  };
}

// 2 nov 2026 es lunes.
const a = habit('a', '2026-11-02', [['2026-11-02', 6], ['2026-11-03', 6], ['2026-11-04', 21]]);
const b = habit('b', '2026-11-03', [['2026-11-03', 7], ['2026-11-04', null]], [2, 3]);

describe('history.utils', () => {
  it('recorre los dias incluidos', () => {
    expect(eachDayKey('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('cuenta programados y cumplidos por dia y marca los perfectos', () => {
    const days = buildDays([a, b], '2026-11-01', '2026-11-05');
    expect(days.map((d) => [d.date, d.scheduled, d.completed, d.rate, d.perfect])).toEqual([
      ['2026-11-01', 0, 0, 0, false], // nada creado todavia
      ['2026-11-02', 1, 1, 100, true], // b no existe aun
      ['2026-11-03', 2, 2, 100, true],
      ['2026-11-04', 2, 2, 100, true],
      ['2026-11-05', 1, 0, 0, false], // b no toca el jueves
    ]);
  });

  it('un dia en pausa o congelado no cuenta, salvo que igual se haya hecho', () => {
    const paused = habit('p', '2026-11-02', [['2026-11-04', 9]], undefined, { skipKeys: new Set(['2026-11-03', '2026-11-04']) });
    const days = buildDays([paused], '2026-11-02', '2026-11-04');
    expect(days.map((d) => [d.scheduled, d.completed])).toEqual([
      [1, 0],
      [0, 0],
      [1, 1],
    ]);
  });

  it('X veces por semana cuenta solo los dias en que se hizo', () => {
    const w = habit('w', '2026-11-02', [['2026-11-03', 9]], undefined, { scheduleType: ScheduleType.WEEKLY_COUNT, weeklyTarget: 3 });
    const days = buildDays([a, w], '2026-11-02', '2026-11-04');
    expect(days.map((d) => [d.scheduled, d.completed, d.perfect])).toEqual([
      [1, 1, true],
      [2, 2, true],
      [1, 1, true],
    ]);
  });

  it('los habitos para dejar no cuentan, salvo en su propio historial', () => {
    const q = habit('q', '2026-11-02', [], undefined, { kind: HabitKind.QUIT, doneKeys: new Set(['2026-11-03']) });
    expect(buildDays([q], '2026-11-02', '2026-11-04').every((d) => d.scheduled === 0)).toBe(true);
    expect(buildDays([q], '2026-11-01', '2026-11-04', { quitAsClean: true }).map((d) => [d.scheduled, d.completed])).toEqual([
      [0, 0],
      [1, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  it('agrupa por dia de la semana', () => {
    const wd = byWeekday(buildDays([a, b], '2026-11-02', '2026-11-05'));
    expect(wd[0]).toEqual({ weekday: 1, scheduled: 1, completed: 1, rate: 100 });
    expect(wd[3]).toEqual({ weekday: 4, scheduled: 1, completed: 0, rate: 0 });
  });

  it('cuenta las horas en que se marco el mismo dia', () => {
    const hours = byHour([a, b], '2026-11-01', '2026-11-30');
    expect(hours[6]).toBe(2);
    expect(hours[7]).toBe(1);
    expect(hours[21]).toBe(1);
    expect(hours.reduce((s, x) => s + x, 0)).toBe(4);
  });

  it('ordena el ranking por cumplimiento', () => {
    const r = ranking([a, b], '2026-11-02', '2026-11-05');
    expect(r.map((x) => [x.id, x.scheduled, x.completed, x.rate])).toEqual([
      ['b', 2, 2, 100],
      ['a', 4, 3, 75],
    ]);
  });

  it('en el ranking, X veces por semana se mide por semanas y la semana en curso no castiga', () => {
    // Semana del 26 oct: 2 de 3. Semana del 2 nov (en curso): 1.
    const w = habit('w', '2026-10-26', [['2026-10-27', 9], ['2026-10-29', 9], ['2026-11-03', 9]], undefined, {
      scheduleType: ScheduleType.WEEKLY_COUNT,
      weeklyTarget: 3,
    });
    const [row] = ranking([w], '2026-10-26', '2026-11-04');
    expect([row.scheduled, row.completed, row.rate]).toEqual([4, 3, 75]);
  });

  it('cruza animo y cumplimiento', () => {
    const days = buildDays([a, b], '2026-11-02', '2026-11-05');
    const moods = new Map([
      ['2026-11-03', 5],
      ['2026-11-05', 2],
    ]);
    expect(moodSummary(days, moods)).toEqual({ entries: 2, average: 3.5, highRate: 100, lowRate: 0 });
  });

  it('arma el habito de Prisma con pausas propias y de todos, y recaidas en QUIT', () => {
    const pauses = [
      { id: 'p1', habitId: null, startKey: '2026-11-10', endKey: '2026-11-11', note: null },
      { id: 'p2', habitId: 'x', startKey: '2026-11-20', endKey: '2026-11-20', note: null },
      { id: 'p3', habitId: 'otro', startKey: '2026-11-25', endKey: '2026-11-25', note: null },
    ];
    expect(pauseKeysFor('x', pauses)).toEqual(['2026-11-10', '2026-11-11', '2026-11-20']);
    const base = {
      id: 'x',
      title: 'Fumar',
      icon: null,
      color: '#000000',
      scheduleType: ScheduleType.DAILY,
      scheduleDays: [1, 2, 3, 4, 5, 6, 7],
      weeklyTarget: null,
      streakEnabled: true,
      goal: 1,
      unit: null,
      createdAt: new Date(2026, 10, 5, 10),
      completions: [],
      relapses: [{ date: new Date(Date.UTC(2026, 10, 8)) }],
      freezes: [{ date: new Date(Date.UTC(2026, 10, 9)) }],
    };
    const q = toHistoryHabit({ ...base, kind: HabitKind.QUIT, startDate: new Date(Date.UTC(2026, 9, 1)) }, pauses);
    expect(q.startKey).toBe('2026-10-01');
    expect(q.createdKey).toBe('2026-11-05');
    expect([...q.doneKeys]).toEqual(['2026-11-08']);
    expect([...q.skipKeys].sort()).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-20']);
  });
});
