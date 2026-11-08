import { ScheduleType } from '@prisma/client';
import { buildDays, byHour, byWeekday, eachDayKey, moodSummary, ranking, type HistoryHabit } from './history.utils';

function habit(id: string, createdKey: string, done: [string, number | null][], days?: number[]): HistoryHabit {
  return {
    id,
    title: id,
    icon: null,
    color: '#FF7A1A',
    scheduleType: days ? ScheduleType.WEEKLY : ScheduleType.DAILY,
    scheduleDays: days ?? [1, 2, 3, 4, 5, 6, 7],
    streakEnabled: true,
    createdKey,
    completions: done.map(([key, hour]) => ({ key, hour })),
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

  it('cruza animo y cumplimiento', () => {
    const days = buildDays([a, b], '2026-11-02', '2026-11-05');
    const moods = new Map([
      ['2026-11-03', 5],
      ['2026-11-05', 2],
    ]);
    expect(moodSummary(days, moods)).toEqual({ entries: 2, average: 3.5, highRate: 100, lowRate: 0 });
  });
});
