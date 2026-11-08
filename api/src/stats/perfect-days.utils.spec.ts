import { HabitKind, ScheduleType } from '@prisma/client';
import type { RuleHabit } from '../habits/habit-rules';
import { computePerfectStreak } from './perfect-days.utils';

function habit(startKey: string, done: string[], days?: number[], over: Partial<RuleHabit> = {}): RuleHabit {
  return {
    kind: HabitKind.BUILD,
    scheduleType: days ? ScheduleType.WEEKLY : ScheduleType.DAILY,
    scheduleDays: days ?? [1, 2, 3, 4, 5, 6, 7],
    weeklyTarget: null,
    streakEnabled: true,
    startKey,
    doneKeys: new Set(done),
    skipKeys: new Set(),
    ...over,
  };
}

// 2026-11-07 es sabado
const today = '2026-11-07';

describe('computePerfectStreak', () => {
  it('cuenta dias perfectos hacia atras y no rompe si hoy aun esta pendiente', () => {
    const a = habit('2026-11-01', ['2026-11-04', '2026-11-05', '2026-11-06']);
    const b = habit('2026-11-01', ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
    expect(computePerfectStreak([a, b], today)).toEqual({ streak: 3, todayPerfect: false });
  });

  it('suma hoy cuando ya esta completo', () => {
    const a = habit('2026-11-05', ['2026-11-05', '2026-11-06', '2026-11-07']);
    expect(computePerfectStreak([a], today)).toEqual({ streak: 3, todayPerfect: true });
  });

  it('un dia incompleto corta la racha', () => {
    const a = habit('2026-11-01', ['2026-11-03', '2026-11-04', '2026-11-06']);
    expect(computePerfectStreak([a], today).streak).toBe(1);
  });

  it('ignora habitos antes de su creacion y dias sin nada programado', () => {
    // Habito de lun/mie/vie: el jueves 5 y el sabado 7 no esta programado.
    const weekly = habit('2026-11-02', ['2026-11-02', '2026-11-04', '2026-11-06'], [1, 3, 5]);
    // Habito diario creado el viernes 6: no cuenta antes.
    const daily = habit('2026-11-06', ['2026-11-06', '2026-11-07']);
    expect(computePerfectStreak([weekly, daily], today)).toEqual({ streak: 4, todayPerfect: true });
  });

  it('un dia congelado o en pausa no rompe', () => {
    const a = habit('2026-11-01', ['2026-11-04', '2026-11-06', '2026-11-07'], undefined, { skipKeys: new Set(['2026-11-05']) });
    expect(computePerfectStreak([a], today)).toEqual({ streak: 3, todayPerfect: true });
  });

  it('lo flexible y los habitos para dejar no lo arruinan', () => {
    const a = habit('2026-11-01', ['2026-11-05', '2026-11-06', '2026-11-07']);
    const weekly = habit('2026-11-01', ['2026-11-06'], undefined, { scheduleType: ScheduleType.WEEKLY_COUNT, weeklyTarget: 3 });
    const quit = habit('2026-10-01', ['2026-11-06'], undefined, { kind: HabitKind.QUIT });
    expect(computePerfectStreak([a, weekly, quit], today)).toEqual({ streak: 3, todayPerfect: true });
  });
});
