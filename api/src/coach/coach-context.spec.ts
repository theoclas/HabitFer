import { HabitKind, ScheduleType } from '@prisma/client';
import type { HistoryHabit } from '../stats/history.utils';
import { buildCoachContext, coachWeek } from './coach-context';

function habit(id: string, done: string[], over: Partial<HistoryHabit> = {}): HistoryHabit {
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
    createdKey: '2026-10-01',
    startKey: '2026-10-01',
    completions: done.map((key) => ({ key, hour: 8 })),
    doneKeys: new Set(done),
    skipKeys: new Set(),
    ...over,
  };
}

describe('coach-context', () => {
  it('elige la semana: el lunes revisa la que termino', () => {
    // 9 nov 2026 es lunes; 8 es domingo; 11 es miercoles.
    expect(coachWeek('2026-11-09')).toEqual({ start: '2026-11-02', end: '2026-11-08', complete: true });
    expect(coachWeek('2026-11-08')).toEqual({ start: '2026-11-02', end: '2026-11-08', complete: true });
    expect(coachWeek('2026-11-11')).toEqual({ start: '2026-11-09', end: '2026-11-11', complete: false });
  });

  it('resume la semana por habito, con dias fallados, dejar algo y veces por semana', () => {
    const leer = habit('Leer', ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    const gym = habit('Gimnasio', ['2026-11-03', '2026-11-05'], { scheduleType: ScheduleType.WEEKLY_COUNT, weeklyTarget: 3 });
    const fumar = habit('No fumar', [], { kind: HabitKind.QUIT, startKey: '2026-10-20', doneKeys: new Set(['2026-11-04']) });
    const ctx = buildCoachContext({
      name: 'Fernando',
      habits: [leer, gym, fumar],
      moods: new Map([
        ['2026-11-03', 4],
        ['2026-11-06', 5],
      ]),
      notes: [{ date: '2026-11-06', habit: 'Leer', note: 'con lluvia salió solo' }],
      start: '2026-11-02',
      end: '2026-11-08',
      todayKey: '2026-11-09',
      level: { level: 13, title: 'Imparable' },
      xpWeek: 120,
      achievements: ['Leer · 5 días'],
      insights: ['Los miércoles te cuesta «Leer»'],
    });
    expect(ctx.semana).toEqual({ desde: '2026-11-02', hasta: '2026-11-08', completa: true });
    expect(ctx.habitos[0]).toMatchObject({ titulo: 'Leer', tipo: 'diario', hechos: 6, pedidos: 7, fallados: ['miércoles'] });
    expect(ctx.habitos[1]).toMatchObject({ titulo: 'Gimnasio', tipo: '3 veces por semana', hechos: 2, meta: 3 });
    expect(ctx.habitos[2]).toMatchObject({ titulo: 'No fumar', tipo: 'dejar', diasLimpio: 4, recaidasEstaSemana: 1 });
    expect(ctx.cumplimiento).toMatchObject({ hechos: 8, pedidos: 9 });
    expect(ctx.animo).toEqual({ promedio: 4.5, diasRegistrados: 2, escala: '1 a 5' });
    expect(ctx.notas).toEqual(['Leer: con lluvia salió solo']);
  });
});
