import { HabitKind, ScheduleType } from '@prisma/client';
import { parseDateKey, toIsoWeekday } from '../common/date.utils';
import {
  cleanDays,
  countsOn,
  currentStreak,
  isDoneOn,
  isRequiredOn,
  longestStreak,
  shiftKey,
  weekDoneCount,
  weeklyTargetOf,
  weekStartKey,
} from '../habits/habit-rules';
import { buildDays, type HistoryHabit } from '../stats/history.utils';

const WEEKDAY = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/**
 * Semana que revisa el coach: de lunes a domingo. Si hoy es lunes, la que acaba de terminar
 * (la de esta semana apenas empieza); si no, la actual hasta hoy.
 */
export function coachWeek(todayKey: string): { start: string; end: string; complete: boolean } {
  const thisMonday = weekStartKey(todayKey);
  const start = todayKey === thisMonday ? shiftKey(thisMonday, -7) : thisMonday;
  const sunday = shiftKey(start, 6);
  return { start, end: sunday < todayKey ? sunday : todayKey, complete: sunday <= todayKey };
}

function pct(done: number, total: number): number {
  return total ? Math.round((done / total) * 100) : 0;
}

export type CoachContextInput = {
  name: string;
  habits: HistoryHabit[];
  moods: Map<string, number>;
  /** Notas de la semana (las mas recientes primero). */
  notes: { date: string; habit: string; note: string }[];
  start: string;
  end: string;
  todayKey: string;
  level: { level: number; title: string };
  xpWeek: number;
  achievements: string[];
  insights: string[];
};

/** Resumen compacto de la semana para el coach (en español, sin datos que no hagan falta). */
export function buildCoachContext(input: CoachContextInput) {
  const { habits, start, end, todayKey } = input;
  const days = buildDays(habits, start, end);
  const prev = buildDays(habits, shiftKey(start, -7), shiftKey(start, -1));
  const scheduled = days.reduce((s, d) => s + d.scheduled, 0);
  const completed = days.reduce((s, d) => s + d.completed, 0);
  const prevScheduled = prev.reduce((s, d) => s + d.scheduled, 0);
  const keys: string[] = [];
  for (let k = start; k <= end; k = shiftKey(k, 1)) keys.push(k);

  const habitos = habits.map((h) => {
    if (h.kind === HabitKind.QUIT) {
      return {
        titulo: h.title,
        tipo: 'dejar',
        // Como se ven en la app ahora mismo (si ya paso el domingo, ese dia tambien cuenta).
        diasLimpio: cleanDays(h, todayKey),
        mejorMarca: longestStreak(h, todayKey),
        recaidasEstaSemana: keys.filter((k) => h.doneKeys.has(k)).length,
      };
    }
    if (h.scheduleType === ScheduleType.WEEKLY_COUNT) {
      const target = weeklyTargetOf(h);
      return {
        titulo: h.title,
        tipo: `${target} ${target === 1 ? 'vez' : 'veces'} por semana`,
        hechos: weekDoneCount(h, start, end),
        meta: target,
        rachaSemanas: h.streakEnabled ? currentStreak(h, end) : null,
      };
    }
    let pedidos = 0;
    let hechos = 0;
    const fallados: string[] = [];
    for (const k of keys) {
      if (!countsOn(h, k)) continue;
      pedidos++;
      if (isDoneOn(h, k)) hechos++;
      else if (isRequiredOn(h, k) && k < todayKey) fallados.push(WEEKDAY[toIsoWeekday(parseDateKey(k))]);
    }
    return {
      titulo: h.title,
      tipo: h.goal > 1 ? `medible (${h.goal}${h.unit ? ` ${h.unit}` : ''} al día)` : h.scheduleType === ScheduleType.WEEKLY ? 'días fijos' : 'diario',
      hechos,
      pedidos,
      rachaDias: h.streakEnabled ? currentStreak(h, end) : null,
      fallados,
    };
  });

  const moodValues = keys.map((k) => input.moods.get(k)).filter((v): v is number => v !== undefined);
  return {
    nombre: input.name,
    semana: { desde: start, hasta: end, completa: end === shiftKey(start, 6) },
    cumplimiento: {
      porcentaje: pct(completed, scheduled),
      hechos: completed,
      pedidos: scheduled,
      diasPerfectos: days.filter((d) => d.perfect).length,
      semanaAnterior: prevScheduled ? pct(prev.reduce((s, d) => s + d.completed, 0), prevScheduled) : null,
    },
    habitos,
    animo: moodValues.length
      ? { promedio: Math.round((moodValues.reduce((s, x) => s + x, 0) / moodValues.length) * 10) / 10, diasRegistrados: moodValues.length, escala: '1 a 5' }
      : null,
    notas: input.notes.slice(0, 6).map((n) => `${n.habit}: ${n.note.slice(0, 140)}`),
    nivel: { ...input.level, xpEstaSemana: input.xpWeek },
    logrosEstaSemana: input.achievements.slice(0, 6),
    observaciones: input.insights.slice(0, 3),
  };
}

export type CoachContext = ReturnType<typeof buildCoachContext>;
