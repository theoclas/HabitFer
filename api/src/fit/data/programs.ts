import type { Focus, ReadyRoutine } from './types';

/*
 * Programas de varias semanas. Cada semana trae sus sesiones (una por día de entreno) armadas con ejercicios de la
 * biblioteca, y de una semana a otra sube un poco: más series, repeticiones o tiempo, y menos descanso.
 * Todo es de bajo impacto (sin saltos). Cada sesión es una rutina con clave «<programa>--s<semana>-<número>».
 */

export type ProgramDef = {
  key: string;
  name: string;
  summary: string;
  level: 1 | 2 | 3;
  focus: Focus | 'mixta';
  weeks: number;
  daysPerWeek: number;
  /** Días sugeridos (0 = lunes … 6 = domingo). */
  suggestedDays: number[];
  /** Qué cambia cada semana, en una frase. */
  weekNotes: string[];
  /** Las sesiones de cada semana: sessions[semana - 1][número - 1]. */
  sessions: ReadyRoutine[][];
};

/** [ejercicio, series, cantidad, «r» repeticiones o «s» segundos, descanso]. */
type It = [string, number, number, 'r' | 's', number];

export const sessionKey = (program: string, week: number, n: number) => `${program}--s${week}-${n}`;

/** Lee «programa--s2-3» → { program, week: 2, n: 3 }. */
export function parseSessionKey(key: string): { program: string; week: number; n: number } | null {
  const m = /^([a-z0-9-]+?)--s(\d{1,2})-(\d)$/.exec(key);
  return m ? { program: m[1], week: Number(m[2]), n: Number(m[3]) } : null;
}

function session(
  program: { key: string; name: string },
  week: number,
  n: number,
  title: string,
  note: string,
  focus: Focus | 'mixta',
  level: 1 | 2 | 3,
  items: It[],
  circuit = false,
  rounds = 1,
): ReadyRoutine {
  return {
    key: sessionKey(program.key, week, n),
    name: `Semana ${week} · ${title}`,
    summary: `${program.name}: ${note}`,
    focus,
    level,
    circuit,
    rounds,
    items: items.map(([key, sets, amount, unit, rest]) => (unit === 'r' ? { key, sets, reps: amount, rest } : { key, sets, seconds: amount, rest })),
  };
}

/* ---------- Empieza desde cero: 4 semanas, 3 días ---------- */

const CERO = { key: 'empieza-desde-cero', name: 'Empieza desde cero' };
const CERO_WEEKS = [
  { sets: 2, reps: 8, hold: 20, cardio: 45, rest: 60, rounds: 2, note: 'pocas repeticiones y descansos largos para aprender la técnica.' },
  { sets: 2, reps: 10, hold: 25, cardio: 50, rest: 50, rounds: 2, note: 'dos repeticiones más y un poco menos de descanso.' },
  { sets: 3, reps: 10, hold: 30, cardio: 60, rest: 45, rounds: 3, note: 'una serie más en cada ejercicio.' },
  { sets: 3, reps: 12, hold: 35, cardio: 60, rest: 40, rounds: 3, note: 'la última: más repeticiones y descansos más cortos.' },
];

function ceroWeek(w: number): ReadyRoutine[] {
  const p = CERO_WEEKS[w - 1];
  return [
    session(CERO, w, 1, 'Fuerza suave', p.note, 'fuerza', 1, [
      ['marcha', 1, p.cardio, 's', 15],
      ['sentadilla-silla', p.sets, p.reps, 'r', p.rest],
      ['flexion-pared', p.sets, p.reps, 'r', p.rest],
      ['puente-gluteo', p.sets, p.reps + 2, 'r', p.rest],
      ['elevacion-talones', p.sets, p.reps + 4, 'r', 30],
      ['plancha-rodillas', p.sets, p.hold, 's', 45],
      ['estiramiento-isquios', 1, 30, 's', 10],
      ['nino', 1, 40, 's', 0],
    ]),
    session(CERO, w, 2, 'Movimiento y abdomen', p.note, 'core', 1, [
      ['circulos-brazos', 1, 30, 's', 10],
      ['gato-vaca', 1, 8, 'r', 15],
      ['perro-pajaro', p.sets, p.reps - 2, 'r', 30],
      ['bicho-muerto', p.sets, p.reps - 2, 'r', 30],
      ['zancada-fija', p.sets, p.reps - 2, 'r', p.rest],
      ['superman', p.sets, p.reps, 'r', 30],
      ['cobra', 1, 20, 's', 10],
      ['nino', 1, 40, 's', 0],
    ]),
    session(
      CERO,
      w,
      3,
      'Cardio sin saltos',
      p.note,
      'cardio',
      1,
      [
        ['marcha', 1, p.cardio, 's', 15],
        ['paso-lateral', 1, p.cardio - 15, 's', 15],
        ['boxeo-sombra', 1, p.cardio - 15, 's', 15],
        ['sentadilla-alcance', 1, p.reps, 'r', 15],
        ['talones-gluteo', 1, p.cardio - 15, 's', 60],
      ],
      true,
      p.rounds,
    ),
  ];
}

/* ---------- Bajo impacto para bajar de peso: 6 semanas, 4 días ---------- */

const BAJAR = { key: 'bajo-impacto-bajar-peso', name: 'Bajo impacto para bajar de peso' };
const BAJAR_WEEKS = [
  { work: 30, rest: 30, rounds: 2, sets: 2, reps: 10, hold: 20, note: 'base: 30 segundos de trabajo y 30 de descanso.' },
  { work: 35, rest: 25, rounds: 2, sets: 2, reps: 12, hold: 25, note: 'un poco más de trabajo y menos descanso.' },
  { work: 40, rest: 20, rounds: 3, sets: 3, reps: 10, hold: 30, note: 'una vuelta y una serie más.' },
  { work: 40, rest: 20, rounds: 3, sets: 3, reps: 12, hold: 30, note: 'más repeticiones con el mismo tiempo.' },
  { work: 45, rest: 15, rounds: 3, sets: 3, reps: 12, hold: 35, note: '45 segundos de trabajo y descansos cortos.' },
  { work: 45, rest: 15, rounds: 4, sets: 3, reps: 15, hold: 40, note: 'la última: cuatro vueltas y más repeticiones.' },
];

function bajarWeek(w: number): ReadyRoutine[] {
  const p = BAJAR_WEEKS[w - 1];
  const push = w <= 3 ? 'flexion-pared' : 'flexion-inclinada';
  const lunge = w <= 2 ? 'zancada-fija' : 'zancada-atras';
  return [
    session(
      BAJAR,
      w,
      1,
      'Circuito de piernas',
      p.note,
      'fuerza',
      1,
      [
        ['marcha', 1, p.work, 's', p.rest],
        ['sentadilla', 1, p.reps, 'r', p.rest],
        ['paso-lateral', 1, p.work, 's', p.rest],
        ['puente-gluteo', 1, p.reps + 2, 'r', p.rest],
        [lunge, 1, Math.max(6, p.reps - 4), 'r', p.rest],
        ['elevacion-talones', 1, p.reps + 5, 'r', 60],
      ],
      true,
      p.rounds,
    ),
    session(BAJAR, w, 2, 'Brazos y abdomen', p.note, 'fuerza', 1, [
      [push, p.sets, p.reps, 'r', 45],
      ['superman', p.sets, p.reps, 'r', 30],
      ...(w >= 3 ? ([['triceps-silla', p.sets, Math.max(6, p.reps - 4), 'r', 45]] as It[]) : []),
      ['plancha-rodillas', p.sets, p.hold, 's', 30],
      ['bicho-muerto', p.sets, Math.max(6, p.reps - 4), 'r', 30],
      ['crunch', p.sets, p.reps, 'r', 30],
      ['estiramiento-hombro', 1, 20, 's', 5],
      ['cobra', 1, 20, 's', 0],
    ]),
    session(
      BAJAR,
      w,
      3,
      'Cardio por intervalos',
      p.note,
      'cardio',
      1,
      [
        ['marcha', 1, p.work, 's', p.rest],
        ['rodillas-arriba', 1, p.work, 's', p.rest],
        ['boxeo-sombra', 1, p.work, 's', p.rest],
        ['talones-gluteo', 1, p.work, 's', p.rest],
        ['golpes-arriba', 1, p.work, 's', p.rest],
        [w >= 3 ? 'escaladores-lentos' : 'sentadilla-alcance', 1, w >= 3 ? p.work : p.reps, w >= 3 ? 's' : 'r', 60],
      ],
      true,
      p.rounds,
    ),
    session(BAJAR, w, 4, 'Cuerpo completo', p.note, 'mixta', 1, [
      ['marcha', 1, 60, 's', 15],
      ['sentadilla-sumo', p.sets, p.reps, 'r', 45],
      [push, p.sets, p.reps, 'r', 45],
      ['buenos-dias', p.sets, p.reps, 'r', 45],
      ['perro-pajaro', p.sets, Math.max(6, p.reps - 4), 'r', 30],
      ['sentadilla-pared', p.sets, p.hold, 's', 45],
      ['estiramiento-isquios', 1, 30, 's', 8],
      ['estiramiento-cuadriceps', 1, 30, 's', 0],
    ]),
  ];
}

export const PROGRAMS: ProgramDef[] = [
  {
    ...CERO,
    summary: 'Para arrancar sin lesiones: tres días por semana, sin saltos, y cada semana un poco más.',
    level: 1,
    focus: 'mixta',
    weeks: CERO_WEEKS.length,
    daysPerWeek: 3,
    suggestedDays: [0, 2, 4],
    weekNotes: CERO_WEEKS.map((w) => w.note),
    sessions: CERO_WEEKS.map((_, i) => ceroWeek(i + 1)),
  },
  {
    ...BAJAR,
    summary: 'Cuatro días por semana de circuitos y cardio sin saltos para gastar más y cuidar las rodillas.',
    level: 1,
    focus: 'cardio',
    weeks: BAJAR_WEEKS.length,
    daysPerWeek: 4,
    suggestedDays: [0, 1, 3, 5],
    weekNotes: BAJAR_WEEKS.map((w) => w.note),
    sessions: BAJAR_WEEKS.map((_, i) => bajarWeek(i + 1)),
  },
];
