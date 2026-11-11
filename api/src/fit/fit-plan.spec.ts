import { PROGRAMS, parseSessionKey, sessionKey } from './data/programs';
import { streakFor, workoutMinutes } from './fit-math';
import { matchDone, moveProblem, programEnd, programWeekOn, statusOf, weekPlanned, type Move, type Run, type TemplateDay } from './fit-plan';
import { EXERCISE_BY_KEY, PROGRAM_BY_KEY, SESSION_BY_KEY, resolveReady } from './library';

// El lunes 9 de noviembre de 2026; la semana va hasta el domingo 15.
const MONDAY = '2026-11-09';
const ready = (readyKey: string) => ({ routineId: null, readyKey });
const own = (routineId: string) => ({ routineId, readyKey: null });
const programs = new Map([['cero', { key: 'cero', weeks: 2, daysPerWeek: 2 }]]);
const input = (o: { template?: TemplateDay[]; runs?: Run[]; moves?: Move[] }) => ({
  template: o.template ?? [],
  runs: o.runs ?? [],
  programs,
  moves: o.moves ?? [],
  sessionKey,
});
const show = (days: ReturnType<typeof weekPlanned>) => days.map((d) => d.items.map((i) => i.readyKey ?? i.routineId).join('+') || '-');

describe('plan de la semana', () => {
  const template: TemplateDay[] = [
    { weekday: 0, ...ready('empieza-aqui') },
    { weekday: 2, ...own('r1') },
    { weekday: 4, ...ready('fuerza-sin-equipo') },
  ];

  it('cada día con su rutina; los demás de descanso', () => {
    expect(show(weekPlanned(MONDAY, input({ template })))).toEqual(['empieza-aqui', '-', 'r1', '-', 'fuerza-sin-equipo', '-', '-']);
  });

  it('mientras corre un programa manda el programa y el plan queda en pausa', () => {
    const runs: Run[] = [{ programKey: 'cero', startDate: MONDAY, weekdays: [1, 3], stoppedOn: null }];
    expect(show(weekPlanned(MONDAY, input({ template, runs })))).toEqual(['-', 'cero--s1-1', '-', 'cero--s1-2', '-', '-', '-']);
    // La semana siguiente es la 2; después de la última semana vuelve el plan.
    expect(show(weekPlanned('2026-11-16', input({ template, runs })))[1]).toBe('cero--s2-1');
    expect(show(weekPlanned('2026-11-23', input({ template, runs })))[0]).toBe('empieza-aqui');
  });

  it('un programa dejado deja de ponerse desde ese día', () => {
    const runs: Run[] = [{ programKey: 'cero', startDate: MONDAY, weekdays: [1, 3], stoppedOn: '2026-11-11' }];
    expect(show(weekPlanned(MONDAY, input({ template, runs })))).toEqual(['-', 'cero--s1-1', 'r1', '-', 'fuerza-sin-equipo', '-', '-']);
  });

  it('mover pasa la rutina a otro día, y se puede volver a mover', () => {
    const moves: Move[] = [
      { id: 'm1', fromDate: '2026-11-09', toDate: '2026-11-11', ...ready('empieza-aqui') },
      { id: 'm2', fromDate: '2026-11-11', toDate: '2026-11-14', ...ready('empieza-aqui') },
    ];
    const days = weekPlanned(MONDAY, input({ template, moves }));
    expect(show(days)).toEqual(['-', '-', 'r1', '-', 'fuerza-sin-equipo', 'empieza-aqui', '-']);
    expect(days[5].items[0]).toMatchObject({ source: 'move', movedFrom: '2026-11-11', moveId: 'm2' });
  });
});

describe('qué de lo planeado se hizo', () => {
  it('el mismo día, o un día después en la misma semana; cada entreno cuenta una vez', () => {
    const days = weekPlanned(MONDAY, input({ template: [{ weekday: 0, ...ready('a') }, { weekday: 1, ...ready('a') }, { weekday: 3, ...ready('b') }] }));
    const done = matchDone(days, [
      { date: '2026-11-10', ...ready('a') },
      { date: '2026-11-11', ...ready('a') },
      { date: '2026-11-11', ...ready('b') },
    ]);
    expect(done[0].items[0].doneOn).toBe('2026-11-11');
    expect(done[1].items[0].doneOn).toBe('2026-11-10');
    // «b» se hizo antes de su día: no cuenta para el jueves.
    expect(done[3].items[0].doneOn).toBeNull();
    expect(statusOf('2026-11-12', null, '2026-11-13')).toBe('missed');
    expect(statusOf('2026-11-13', null, '2026-11-13')).toBe('today');
    expect(statusOf('2026-11-14', null, '2026-11-13')).toBe('upcoming');
    expect(statusOf('2026-11-12', '2026-11-13', '2026-11-13')).toBe('done');
  });

  it('solo se mueve dentro de la semana y hacia hoy o después', () => {
    expect(moveProblem('2026-11-10', '2026-11-12', '2026-11-11')).toBeNull();
    expect(moveProblem('2026-11-10', '2026-11-10', '2026-11-11')).toMatch(/otro día/);
    expect(moveProblem('2026-11-13', '2026-11-16', '2026-11-11')).toMatch(/misma semana/);
    expect(moveProblem('2026-11-12', '2026-11-10', '2026-11-11')).toMatch(/ya pasó/);
  });
});

describe('meta por días o por minutos', () => {
  const today = '2026-11-12';
  const logs = [
    { date: '2026-11-02', minutes: 40 },
    { date: '2026-11-04', minutes: 30 },
    { date: '2026-11-04', minutes: 25 },
    { date: '2026-11-10', minutes: 20 },
  ];

  it('por minutos suma los de la semana (varios entrenos el mismo día se suman)', () => {
    const s = streakFor(logs, { kind: 'minutes', days: 3, minutes: 90 }, today);
    expect(s.weeks).toBe(1);
    expect(s.week).toMatchObject({ trainedDays: 1, minutes: 20, met: false, left: 70 });
    expect(s.kind).toBe('minutes');
  });

  it('por días cuenta días distintos', () => {
    const s = streakFor(logs, { kind: 'days', days: 2, minutes: 90 }, today);
    expect(s.weeks).toBe(1);
    expect(s.week.left).toBe(1);
  });

  it('los minutos de un entreno chuleado a mano se calculan con lo hecho', () => {
    const item = (done: boolean) => ({ key: 'sentadilla', name: 's', sets: 3, reps: 12, seconds: null, done });
    expect(workoutMinutes({ kind: 'ROUTINE', minutes: 18, items: null })).toBe(18);
    expect(workoutMinutes({ kind: 'ROUTINE', minutes: null, items: [item(true), item(false)] })).toBe(3);
    expect(workoutMinutes({ kind: 'ACTIVITY', minutes: null, items: null })).toBe(0);
  });
});

describe('programas', () => {
  it('cada semana trae sus sesiones, con ejercicios que existen y sin saltos', () => {
    for (const p of PROGRAMS) {
      expect(p.sessions).toHaveLength(p.weeks);
      expect(p.suggestedDays).toHaveLength(p.daysPerWeek);
      expect(p.weekNotes).toHaveLength(p.weeks);
      p.sessions.forEach((week, w) => {
        expect(week).toHaveLength(p.daysPerWeek);
        week.forEach((s, n) => {
          expect(s.key).toBe(sessionKey(p.key, w + 1, n + 1));
          expect(parseSessionKey(s.key)).toEqual({ program: p.key, week: w + 1, n: n + 1 });
          expect(SESSION_BY_KEY.get(s.key)).toBe(s);
          expect(resolveReady(s.key)).toBe(s);
          for (const i of s.items) {
            const ex = EXERCISE_BY_KEY.get(i.key);
            expect([s.key, i.key, !!ex, ex?.impact]).toEqual([s.key, i.key, true, 'bajo']);
            expect((i.reps ?? i.seconds ?? 0) > 0).toBe(true);
          }
        });
      });
    }
  });

  it('sube de a poco: la última semana pide más que la primera', () => {
    const total = (key: string) => {
      const s = resolveReady(key)!;
      return s.items.reduce((n, i) => n + i.sets * (i.reps ?? i.seconds ?? 0), 0) * s.rounds;
    };
    for (const p of PROGRAMS) {
      for (let n = 1; n <= p.daysPerWeek; n++) expect(total(sessionKey(p.key, p.weeks, n))).toBeGreaterThan(total(sessionKey(p.key, 1, n)));
    }
  });

  it('semana del programa y su final', () => {
    const p = PROGRAM_BY_KEY.get('empieza-desde-cero')!;
    const run: Run = { programKey: p.key, startDate: MONDAY, weekdays: [0, 2, 4], stoppedOn: null };
    expect(programWeekOn(run, p, '2026-11-08')).toBeNull();
    expect(programWeekOn(run, p, '2026-11-15')).toBe(1);
    expect(programWeekOn(run, p, '2026-11-16')).toBe(2);
    expect(programEnd(run, p)).toBe('2026-12-06');
    expect(programWeekOn(run, p, '2026-12-07')).toBeNull();
  });
});
