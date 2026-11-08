import { HabitKind, ScheduleType } from '@prisma/client';
import { shiftKey } from '../habits/habit-rules';
import type { HistoryHabit } from './history.utils';
import { lastDayOfMonth, monthSummary, previousMonth } from './month.utils';

function habit(id: string, startKey: string, done: string[], over: Partial<HistoryHabit> = {}): HistoryHabit {
  return {
    id,
    title: id,
    icon: '🔥',
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
    completions: done.map((key) => ({ key, hour: 7 })),
    doneKeys: new Set(done),
    skipKeys: new Set(),
    ...over,
  };
}

function range(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = shiftKey(k, 1)) out.push(k);
  return out;
}

describe('month.utils', () => {
  it('fechas del mes', () => {
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });

  it('resume un mes terminado: totales, estrella, racha, XP y comparacion', () => {
    // Octubre: Meditar todos los dias; Leer los primeros 10. Septiembre: Meditar la mitad.
    const meditar = habit('Meditar', '2026-09-01', [...range('2026-09-01', '2026-09-15'), ...range('2026-10-01', '2026-10-31')]);
    const leer = habit('Leer', '2026-10-01', range('2026-10-01', '2026-10-10'));
    const s = monthSummary([meditar, leer], new Map([['2026-10-05', 4], ['2026-10-06', 5]]), '2026-10', '2026-11-08');
    expect(s.complete).toBe(true);
    expect(s.totals).toMatchObject({ scheduled: 62, completed: 41, perfectDays: 10, activeDays: 31, days: 31 });
    expect(s.starHabit).toMatchObject({ id: 'Meditar', rate: 100 });
    expect(s.topHabits.map((h) => h.id)).toEqual(['Meditar', 'Leer']);
    expect(s.longestStreak).toMatchObject({ id: 'Meditar', days: 31 });
    expect(s.bestHour).toBe(7);
    expect(s.moodAverage).toBe(4.5);
    expect(s.previousRate).toBe(50);
    expect(s.xp).toBeGreaterThan(41 * 10);
    expect(s.levelEnd).toBeGreaterThanOrEqual(s.levelStart);
  });

  it('el mes en curso va hasta hoy y suma dias limpio terminados', () => {
    const quit = habit('No fumar', '2026-10-20', [], { kind: HabitKind.QUIT, doneKeys: new Set(['2026-11-03']) });
    const s = monthSummary([quit], new Map(), '2026-11', '2026-11-08');
    expect(s.complete).toBe(false);
    expect(s.to).toBe('2026-11-08');
    // Del 1 al 7 (hoy aun no termina), menos la recaida del 3.
    expect(s.cleanDays).toBe(6);
    expect(s.starHabit).toBeNull();
  });
});
