import { HabitKind, ScheduleType } from '@prisma/client';
import {
  cleanDays,
  countsOn,
  currentStreak,
  evaluateChallenge,
  isRequiredOn,
  longestStreak,
  runningStreaks,
  shiftKey,
  weekStartKey,
  type RuleHabit,
} from './habit-rules';

// 2026-11-02 es lunes.
function habit(over: Partial<RuleHabit> & { done?: string[]; skip?: string[] } = {}): RuleHabit {
  const { done = [], skip = [], ...rest } = over;
  return {
    kind: HabitKind.BUILD,
    scheduleType: ScheduleType.DAILY,
    scheduleDays: [1, 2, 3, 4, 5, 6, 7],
    weeklyTarget: null,
    streakEnabled: true,
    startKey: '2026-10-01',
    doneKeys: new Set(done),
    skipKeys: new Set(skip),
    ...rest,
  };
}

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => shiftKey(from, i));

describe('habit-rules: rachas en dias', () => {
  it('cuenta los dias seguidos y hoy pendiente no rompe', () => {
    const h = habit({ done: days('2026-11-01', 5) }); // 1 al 5
    expect(currentStreak(h, '2026-11-05')).toBe(5);
    expect(currentStreak(h, '2026-11-06')).toBe(5); // hoy (6) aun sin marcar
    expect(currentStreak(h, '2026-11-07')).toBe(0); // el 6 se perdio
  });

  it('una pausa o un congelador no rompe la racha ni suma', () => {
    const done = ['2026-11-01', '2026-11-02', '2026-11-05', '2026-11-06'];
    expect(currentStreak(habit({ done }), '2026-11-06')).toBe(2);
    expect(currentStreak(habit({ done, skip: ['2026-11-03', '2026-11-04'] }), '2026-11-06')).toBe(4);
    // Si igual lo hizo en un dia de pausa, cuenta.
    expect(currentStreak(habit({ done: [...done, '2026-11-03'], skip: ['2026-11-03', '2026-11-04'] }), '2026-11-06')).toBe(5);
  });

  it('con dias fijos solo se piden esos dias', () => {
    // Lunes, miercoles y viernes: 2, 4 y 6 de noviembre.
    const h = habit({ scheduleType: ScheduleType.WEEKLY, scheduleDays: [1, 3, 5], done: ['2026-11-02', '2026-11-04', '2026-11-06'] });
    expect(currentStreak(h, '2026-11-08')).toBe(3);
    expect(isRequiredOn(h, '2026-11-03')).toBe(false);
    expect(longestStreak(h, '2026-11-08')).toBe(3);
  });

  it('antes del inicio no se pide nada', () => {
    const h = habit({ startKey: '2026-11-05', done: ['2026-11-05', '2026-11-06'] });
    expect(isRequiredOn(h, '2026-11-04')).toBe(false);
    expect(currentStreak(h, '2026-11-06')).toBe(2);
  });

  it('mejor racha y rachas en curso para el XP', () => {
    const h = habit({ done: [...days('2026-11-01', 3), ...days('2026-11-05', 2)] });
    expect(longestStreak(h, '2026-11-08')).toBe(3);
    expect(runningStreaks(h, '2026-11-08').map((r) => r.streak)).toEqual([1, 2, 3, 1, 2]);
  });

  it('sin racha activada devuelve 0', () => {
    expect(currentStreak(habit({ streakEnabled: false, done: ['2026-11-06'] }), '2026-11-06')).toBe(0);
  });
});

describe('habit-rules: X veces por semana', () => {
  const weekly = (done: string[], over: Partial<RuleHabit> & { skip?: string[] } = {}) =>
    habit({ scheduleType: ScheduleType.WEEKLY_COUNT, weeklyTarget: 3, startKey: '2026-10-12', done, ...over });

  it('ningun dia se pide; lo hecho cuenta en el dia', () => {
    const h = weekly(['2026-11-03']);
    expect(isRequiredOn(h, '2026-11-02')).toBe(false);
    expect(countsOn(h, '2026-11-02')).toBe(false);
    expect(countsOn(h, '2026-11-03')).toBe(true);
  });

  it('la racha son semanas cumplidas y la semana en curso no rompe', () => {
    const h = weekly([
      '2026-10-19', '2026-10-21', '2026-10-23', // semana del 19: cumple
      '2026-10-26', '2026-10-28', '2026-10-30', // semana del 26: cumple
      '2026-11-02', // semana actual: 1 de 3
    ]);
    expect(weekStartKey('2026-11-05')).toBe('2026-11-02');
    expect(currentStreak(h, '2026-11-05')).toBe(2);
    expect(currentStreak(h, '2026-11-12')).toBe(0); // la semana del 2 no llego
  });

  it('una semana con pausa que no llega no rompe; la primera semana incompleta tampoco', () => {
    const h = weekly(['2026-10-19', '2026-10-20', '2026-10-21', '2026-11-02', '2026-11-03', '2026-11-04'], {
      skip: ['2026-10-27', '2026-10-28'],
    });
    expect(currentStreak(h, '2026-11-05')).toBe(2);
    expect(longestStreak(h, '2026-11-05')).toBe(2);
  });
});

describe('habit-rules: dejar algo', () => {
  const quit = (relapses: string[], startKey = '2026-10-01') =>
    habit({ kind: HabitKind.QUIT, startKey, done: relapses, streakEnabled: false });

  it('cuenta dias completos limpio desde el inicio o la ultima recaida', () => {
    expect(cleanDays(quit([]), '2026-10-01')).toBe(0);
    expect(cleanDays(quit([]), '2026-10-11')).toBe(10);
    expect(cleanDays(quit(['2026-10-05']), '2026-10-11')).toBe(5); // del 6 al 10
    expect(cleanDays(quit(['2026-10-11']), '2026-10-11')).toBe(0); // recayo hoy
    expect(currentStreak(quit(['2026-10-05']), '2026-10-11')).toBe(5);
  });

  it('la mejor racha limpia queda aunque haya recaidas', () => {
    expect(longestStreak(quit(['2026-10-21']), '2026-10-25')).toBe(20);
  });

  it('nunca se pide ni cuenta en el dia', () => {
    const h = quit([]);
    expect(isRequiredOn(h, '2026-10-05')).toBe(false);
    expect(countsOn(h, '2026-10-05')).toBe(false);
  });
});

describe('habit-rules: retos', () => {
  it('diario: se gana al cumplir el ultimo dia y se rompe con un dia sin cumplir', () => {
    const start = '2026-11-01';
    const ok = habit({ done: days(start, 7) });
    expect(evaluateChallenge(ok, start, 7, '2026-11-07')).toMatchObject({ status: 'won', done: 7, total: 7, dayIndex: 7 });

    const going = habit({ done: days(start, 3) });
    expect(evaluateChallenge(going, start, 7, '2026-11-04')).toMatchObject({ status: 'active', done: 3, total: 7, dayIndex: 4, remaining: 4 });

    const broken = habit({ done: ['2026-11-01', '2026-11-03'] });
    expect(evaluateChallenge(broken, start, 7, '2026-11-04')).toMatchObject({ status: 'broken', brokenOn: '2026-11-02' });
  });

  it('diario: un congelador salva el reto', () => {
    const h = habit({ done: ['2026-11-01', '2026-11-03', '2026-11-04'], skip: ['2026-11-02'] });
    expect(evaluateChallenge(h, '2026-11-01', 4, '2026-11-04')).toMatchObject({ status: 'won', total: 3 });
  });

  it('dejar algo: se gana al pasar los dias sin recaer', () => {
    const q = (r: string[]) => habit({ kind: HabitKind.QUIT, startKey: '2026-10-01', done: r });
    expect(evaluateChallenge(q([]), '2026-11-01', 30, '2026-11-11')).toMatchObject({ status: 'active', done: 10, total: 30 });
    expect(evaluateChallenge(q([]), '2026-11-01', 30, '2026-12-01')).toMatchObject({ status: 'won', done: 30 });
    expect(evaluateChallenge(q(['2026-11-09']), '2026-11-01', 30, '2026-11-11')).toMatchObject({ status: 'broken', brokenOn: '2026-11-09' });
  });

  it('veces por semana: se gana al juntar las veces y se rompe si ya no alcanza', () => {
    const w = (done: string[]) => habit({ scheduleType: ScheduleType.WEEKLY_COUNT, weeklyTarget: 3, done });
    // 14 dias a 3 por semana = 6 veces.
    expect(evaluateChallenge(w(days('2026-11-01', 6)), '2026-11-01', 14, '2026-11-06')).toMatchObject({ status: 'won', total: 6 });
    // El 8 lleva 1 y quedan 7 dias: todavia alcanza. El 11 ya no (1 + 4 dias < 6).
    expect(evaluateChallenge(w(['2026-11-01']), '2026-11-01', 14, '2026-11-08')).toMatchObject({ status: 'active', done: 1 });
    expect(evaluateChallenge(w(['2026-11-01']), '2026-11-01', 14, '2026-11-11')).toMatchObject({ status: 'broken' });
    expect(evaluateChallenge(w([]), '2026-11-01', 14, '2026-11-12')).toMatchObject({ status: 'broken' });
  });

  it('un reto que aun no empieza', () => {
    expect(evaluateChallenge(habit(), '2026-11-10', 7, '2026-11-08')).toMatchObject({ status: 'upcoming', dayIndex: 0, remaining: 7 });
  });
});
