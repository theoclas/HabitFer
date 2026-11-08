import { ScheduleType } from '@prisma/client';
import { computeXp, levelFromXp, runningStreaks, streakBonus } from './xp.utils';

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

describe('runningStreaks', () => {
  it('encadena dias seguidos y reinicia tras un hueco', () => {
    const r = runningStreaks(ScheduleType.DAILY, ALL_DAYS, ['2026-11-05', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-06']);
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
    const r = runningStreaks(ScheduleType.WEEKLY, [1, 3, 5], ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-13']);
    expect(r.map((x) => x.streak)).toEqual([1, 2, 3, 4, 1]);
  });
});

describe('computeXp', () => {
  it('suma 10 por habito, bono desde 7 dias de racha y 20 por dia perfecto', () => {
    const keys = ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    const res = computeXp(
      [{ scheduleType: ScheduleType.DAILY, scheduleDays: ALL_DAYS, streakEnabled: true, keys }],
      ['2026-11-07'],
      '2026-11-07',
    );
    // 8 x 10 + 3 (dia 7) + 3 (dia 8) + 20 perfecto
    expect(res).toEqual({ xp: 106, todayXp: 33 });
  });

  it('sin racha activada no hay bono', () => {
    const keys = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    const res = computeXp([{ scheduleType: ScheduleType.DAILY, scheduleDays: ALL_DAYS, streakEnabled: false, keys }], [], '2026-11-10');
    expect(res.xp).toBe(100);
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
});
