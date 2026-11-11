import { EXERCISES } from './data/exercises';
import { READY_ROUTINES } from './data/routines';
import { applyLogs, counts, lastLogs, markDone, routineMinutes, streakOf, type WorkoutItem } from './fit-math';
import { buildFigure, figurePoints } from './figure';
import { BLOCKS, EXERCISE_BY_KEY, blockSeconds, library } from './library';

describe('racha por semanas', () => {
  // El 10 de noviembre de 2026 es martes: la semana va del lunes 9 al domingo 15.
  const today = '2026-11-10';

  it('cuenta las semanas seguidas que cumplieron la meta; la de ahora no rompe mientras no termine', () => {
    const days = ['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09'];
    const s = streakOf(days, 3, today);
    expect(s.weeks).toBe(2);
    expect(s.week).toMatchObject({ start: '2026-11-09', trainedDays: 1, met: false, left: 2 });
    expect(s.week.days.map((d) => d.trained)).toEqual([true, false, false, false, false, false, false]);
    expect(s.totalDays).toBe(7);
    expect(s.monthDays).toBe(4);
  });

  it('la semana actual suma cuando ya se cumplió', () => {
    const s = streakOf(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-09', '2026-11-10'], 2, today);
    expect(s.weeks).toBe(2);
    expect(s.week.met).toBe(true);
  });

  it('una semana pasada sin cumplir rompe la racha, y se recuerda la mejor', () => {
    const days = ['2026-10-12', '2026-10-13', '2026-10-19', '2026-10-20', '2026-11-02', '2026-11-03'];
    const s = streakOf(days, 2, today);
    expect(s.weeks).toBe(1);
    expect(s.bestWeeks).toBe(2);
  });

  it('sin nada, todo en cero', () => {
    const s = streakOf([], 3, today);
    expect([s.weeks, s.bestWeeks, s.totalDays]).toEqual([0, 0, 0]);
  });
});

describe('qué cuenta como entrenado', () => {
  const item = (done: boolean) => ({ key: 'sentadilla', name: 'Sentadilla', sets: 3, reps: 12, seconds: null, done });
  it('una rutina con al menos un ejercicio hecho, completa o una actividad', () => {
    expect(counts({ date: '2026-11-10', kind: 'ROUTINE', completed: false, items: [item(false), item(true)] })).toBe(true);
    expect(counts({ date: '2026-11-10', kind: 'ROUTINE', completed: false, items: [item(false)] })).toBe(false);
    expect(counts({ date: '2026-11-10', kind: 'ACTIVITY', completed: true, items: null })).toBe(true);
  });
});

describe('tiempo de una rutina', () => {
  it('series con descanso y el cambio entre ejercicios', () => {
    // 3 × 12 rep (36 s) + 2 descansos de 60 s + 20 s = 248 s; dos iguales ≈ 8 min.
    const it = { sets: 3, reps: 12, restSeconds: 60 };
    expect(routineMinutes([it, it], false, 1)).toBe(8);
  });
  it('un circuito se cuenta por vueltas', () => {
    const it = { sets: 1, seconds: 40, restSeconds: 20 };
    expect(routineMinutes([it, it, it, it, it], true, 3)).toBe(15);
  });
  it('lo que es por lado cuenta doble', () => {
    expect(routineMinutes([{ sets: 1, seconds: 30, restSeconds: 0, perSide: true }], false, 1)).toBe(1);
  });
});

describe('biblioteca', () => {
  it('claves únicas, textos completos y referencias que existen', () => {
    const keys = EXERCISES.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of EXERCISES) {
      expect(e.key).toMatch(/^[a-z0-9-]+$/);
      expect(e.steps.length).toBeGreaterThanOrEqual(2);
      expect(e.reps ?? e.seconds).toBeDefined();
      for (const ref of [e.easier, e.harder]) if (ref) expect(EXERCISE_BY_KEY.has(ref)).toBe(true);
    }
  });

  it('las rutinas listas usan ejercicios que existen', () => {
    for (const r of READY_ROUTINES) {
      for (const i of r.items) expect([r.key, EXERCISE_BY_KEY.has(i.key)]).toEqual([r.key, true]);
      expect(r.items.every((i) => (i.reps ?? i.seconds) !== undefined)).toBe(true);
    }
  });

  it('cada figura cabe en el dibujo y se puede animar', () => {
    for (const e of EXERCISES) {
      const f = buildFigure(e.figure);
      for (const [x, y] of figurePoints(f)) {
        expect([e.key, Number.isFinite(x) && Number.isFinite(y)]).toEqual([e.key, true]);
        expect([e.key, x >= -2 && x <= 122 && y >= -2 && y <= 118]).toEqual([e.key, true]);
      }
      if (e.figure.b) expect([e.key, f.b?.lines.length]).toEqual([e.key, f.a.lines.length]);
    }
  });

  it('la biblioteca trae los minutos de cada rutina lista y una versión', () => {
    const lib = library();
    const body = lib.body as { ready: { minutes: number }[] };
    expect(lib.version).toMatch(/^[0-9a-f]{12}$/);
    expect(body.ready.every((r) => r.minutes > 0)).toBe(true);
  });
});

describe('series reales del modo guiado', () => {
  const it3 = (): WorkoutItem[] =>
    ['sentadilla', 'flexion-pared', 'puente-gluteo'].map((key) => ({ key, name: key, sets: 3, reps: 10, seconds: null, done: false }));

  it('addDone suma a lo chuleado sin desmarcar nada', () => {
    const manual = markDone(it3(), { done: [2] });
    const after = markDone(manual, { addDone: [0] });
    expect(after.map((i) => i.done)).toEqual([true, false, true]);
    expect(markDone(it3(), { completed: true }).every((i) => i.done)).toBe(true);
    expect(markDone(manual, { completed: false }).some((i) => i.done)).toBe(false);
  });

  it('las series se ponen por posición y se limpian', () => {
    const out = applyLogs(it3(), [
      { index: 1, sets: [{ reps: 12.4, seconds: null, weight: 5.26 }, { reps: 10, weight: 0 }] },
      { index: 7, sets: [{ reps: 1 }] },
    ]);
    expect(out[0].log).toBeUndefined();
    expect(out[1].log).toEqual([
      { reps: 12, seconds: null, weight: 5.5 },
      { reps: 10, seconds: null, weight: null },
    ]);
    expect(out).toHaveLength(3);
  });

  it('la última vez es la más reciente que tenga series', () => {
    const withLog = (key: string, reps: number): WorkoutItem => ({ key, name: key, sets: 1, reps, seconds: null, done: true, log: [{ reps, seconds: null, weight: null }] });
    const rows = [
      { date: '2026-11-10', items: [{ key: 'sentadilla', name: 's', sets: 3, reps: 10, seconds: null, done: true }] },
      { date: '2026-11-08', items: [withLog('sentadilla', 12), withLog('superman', 8)] },
      { date: '2026-11-05', items: [withLog('sentadilla', 9)] },
    ];
    const last = lastLogs(rows, ['sentadilla', 'superman', 'nino']);
    expect(last.sentadilla).toEqual({ date: '2026-11-08', sets: [{ reps: 12, seconds: null, weight: null }] });
    expect(last.superman.date).toBe('2026-11-08');
    expect(last.nino).toBeUndefined();
  });
});

describe('calentar y estirar', () => {
  it('usan ejercicios que existen, todo por tiempo, y duran unos 5 minutos', () => {
    for (const block of [BLOCKS.warmup, BLOCKS.cooldown]) {
      for (const i of block.items) {
        expect([i.key, EXERCISE_BY_KEY.has(i.key), typeof i.seconds]).toEqual([i.key, true, 'number']);
      }
      const secs = blockSeconds([...block.items]);
      expect(secs).toBeGreaterThanOrEqual(240);
      expect(secs).toBeLessThanOrEqual(330);
    }
  });

  it('vienen en la biblioteca con sus minutos', () => {
    const body = library().body as { blocks: { warmup: { minutes: number }; cooldown: { minutes: number } } };
    expect(body.blocks.warmup.minutes).toBeGreaterThanOrEqual(4);
    expect(body.blocks.cooldown.minutes).toBeGreaterThanOrEqual(4);
  });
});
