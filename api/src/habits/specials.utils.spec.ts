import { ScheduleType } from '@prisma/client';
import { buildDays, eachDayKey, type HistoryHabit } from '../stats/history.utils';
import { computeSpecials } from './specials.utils';

function daily(id: string, createdKey: string, keys: string[], hour: number | null = 9): HistoryHabit {
  return {
    id,
    title: id,
    icon: null,
    color: '#FF7A1A',
    scheduleType: ScheduleType.DAILY,
    scheduleDays: [1, 2, 3, 4, 5, 6, 7],
    streakEnabled: true,
    createdKey,
    completions: keys.map((key) => ({ key, hour })),
  };
}

describe('computeSpecials', () => {
  it('detecta madrugador, fin de semana y mes perfecto', () => {
    // Todo octubre 2026 perfecto con un habito marcado a las 6 a. m.
    const october = eachDayKey('2026-10-01', '2026-10-31');
    const novSoFar = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06', '2026-11-07'];
    const h = daily('a', '2026-10-01', [...october, ...novSoFar], 6);
    const days = buildDays([h], '2026-10-01', '2026-11-07');
    const s = Object.fromEntries(computeSpecials([h], days, '2026-11-07').map((x) => [x.id, x]));

    expect(s['madrugador']).toMatchObject({ unlocked: true, count: 3 });
    expect(s['fin-de-semana'].unlocked).toBe(true);
    expect(s['fin-de-semana'].count).toBe(5); // 4 fines de semana de octubre + 31 oct/1 nov
    expect(s['mes-perfecto']).toMatchObject({ unlocked: true, count: 1, progress: 6, target: 30 });
    expect(s['mes-perfecto'].note).not.toBeNull(); // el 4 de noviembre falto
    expect(s['cien']).toMatchObject({ unlocked: false, progress: 37 });
    expect(s['treinta-perfectos']).toMatchObject({ unlocked: true, count: 1 });
  });

  it('sin historial no gana nada', () => {
    const h = daily('a', '2026-11-07', []);
    const days = buildDays([h], '2026-11-07', '2026-11-07');
    expect(computeSpecials([h], days, '2026-11-07').every((x) => !x.unlocked)).toBe(true);
  });
});
