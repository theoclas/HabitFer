import { HabitKind, ScheduleType } from '@prisma/client';
import { runningStreaks } from '../habits/habit-rules';
import { computeXp, freezesEarned, levelFromXp, streakBonus, type XpHabit } from './xp.utils';

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

function habit(done: string[], over: Partial<XpHabit> = {}): XpHabit {
  const first = [...done].sort()[0] ?? '2026-11-01';
  return {
    kind: HabitKind.BUILD,
    scheduleType: ScheduleType.DAILY,
    scheduleDays: ALL_DAYS,
    weeklyTarget: null,
    streakEnabled: true,
    startKey: first,
    createdKey: first,
    doneKeys: new Set(done),
    skipKeys: new Set(),
    ...over,
  };
}

describe('runningStreaks', () => {
  it('encadena dias seguidos y reinicia tras un hueco', () => {
    const r = runningStreaks(habit(['2026-11-05', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-06']), '2026-11-06');
    expect(r).toEqual([
      { key: '2026-11-01', streak: 1 },
      { key: '2026-11-02', streak: 2 },
      { key: '2026-11-03', streak: 3 },
      { key: '2026-11-05', streak: 1 },
      { key: '2026-11-06', streak: 2 },
    ]);
  });

  it('en habitos semanales salta los dias no programados', () => {
    // lun/mie/vie: 2, 4, 6 y 9 de nov encadenan; el 13 rompe porque falto el miercoles 11.
    const h = habit(['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-13'], {
      scheduleType: ScheduleType.WEEKLY,
      scheduleDays: [1, 3, 5],
    });
    expect(runningStreaks(h, '2026-11-13').map((x) => x.streak)).toEqual([1, 2, 3, 4, 1]);
  });
});

describe('computeXp', () => {
  it('suma 10 por habito, bono desde 7 dias de racha y 20 por dia perfecto', () => {
    const keys = ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    // 8 x 10 + 3 (dia 7) + 3 (dia 8) + 20 perfecto
    expect(computeXp([habit(keys)], ['2026-11-07'], '2026-11-07')).toEqual({ xp: 106, todayXp: 33 });
  });

  it('sin racha activada no hay bono', () => {
    const keys = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    expect(computeXp([habit(keys, { streakEnabled: false })], [], '2026-11-10').xp).toBe(100);
  });

  it('X veces por semana da 10 por vez, sin bono de racha', () => {
    const keys = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    const h = habit(keys, { scheduleType: ScheduleType.WEEKLY_COUNT, weeklyTarget: 3 });
    expect(computeXp([h], [], '2026-11-10').xp).toBe(100);
  });

  it('dejar algo: 5 por dia limpio terminado desde que se creo', () => {
    // Inicio retroactivo el 1 oct, creado el 1 nov, recaida el 3; hoy 6: limpios 1, 2, 4 y 5.
    const q = habit([], { kind: HabitKind.QUIT, startKey: '2026-10-01', createdKey: '2026-11-01', doneKeys: new Set(['2026-11-03']) });
    expect(computeXp([q], [], '2026-11-06')).toEqual({ xp: 20, todayXp: 0 });
  });

  it('bono por tramo de racha', () => {
    expect([1, 6, 7, 29, 30, 120].map(streakBonus)).toEqual([0, 0, 3, 3, 5, 5]);
  });
});

describe('levelFromXp', () => {
  it('sube de nivel en 100, 300, 600...', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, title: 'Chispa', levelStartXp: 0, nextLevelXp: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(300).level).toBe(3);
    expect(levelFromXp(1000)).toMatchObject({ level: 5, title: 'Constante' });
    expect(levelFromXp(9100)).toMatchObject({ level: 14, title: 'Imparable', levelStartXp: 9100, nextLevelXp: 10500 });
  });

  it('un congelador por cada nivel subido', () => {
    expect([1, 2, 6].map(freezesEarned)).toEqual([0, 1, 5]);
  });
});
