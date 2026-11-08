import { addDays, parseDateKey, toDateKey, toIsoWeekday } from '../common/date.utils';
import type { DayRow, HistoryHabit } from '../stats/history.utils';

export type SpecialAchievement = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Avance hacia `target` (para la barra cuando aun no se gana). */
  progress: number;
  target: number;
  unlocked: boolean;
  /** Veces que se gano (p. ej. fines de semana de hierro). */
  count: number;
  note: string | null;
};

const EARLY_HOUR = 7;

function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Medallas que no dependen de un solo habito: madrugador, fines de semana y meses perfectos,
 * cien habitos cumplidos y treinta dias perfectos. `days` es el historial completo hasta hoy.
 */
export function computeSpecials(habits: HistoryHabit[], days: DayRow[], todayKey: string): SpecialAchievement[] {
  const early = habits.reduce((s, h) => s + h.completions.filter((c) => c.hour !== null && c.hour < EARLY_HOUR).length, 0);
  const totalDone = habits.reduce((s, h) => s + h.completions.length, 0);
  const byKey = new Map(days.map((d) => [d.date, d]));

  let weekends = 0;
  for (const d of days) {
    if (!d.perfect || toIsoWeekday(parseDateKey(d.date)) !== 6) continue;
    const sunday = toDateKey(addDays(parseDateKey(d.date), 1));
    if (byKey.get(sunday)?.perfect) weekends++;
  }

  const currentMonth = todayKey.slice(0, 7);
  const months = new Map<string, DayRow[]>();
  for (const d of days) {
    const m = d.date.slice(0, 7);
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(d);
  }
  let perfectMonths = 0;
  for (const [m, rows] of months) {
    if (m >= currentMonth) continue;
    const active = rows.filter((r) => r.scheduled > 0);
    if (active.length >= 20 && active.every((r) => r.perfect)) perfectMonths++;
  }
  const thisMonth = months.get(currentMonth) ?? [];
  const perfectThisMonth = thisMonth.filter((r) => r.perfect).length;
  const brokenThisMonth = thisMonth.some((r) => r.date < todayKey && r.scheduled > 0 && !r.perfect);
  const perfectTotal = days.filter((d) => d.perfect).length;

  return [
    {
      id: 'madrugador',
      name: 'Madrugador',
      emoji: '🌅',
      description: 'Marca 10 hábitos antes de las 7 a. m.',
      progress: Math.min(early, 10),
      target: 10,
      unlocked: early >= 10,
      count: early >= 10 ? Math.floor(early / 10) : 0,
      note: null,
    },
    {
      id: 'fin-de-semana',
      name: 'Fin de semana de hierro',
      emoji: '🛡️',
      description: 'Sábado y domingo perfectos',
      progress: Math.min(weekends, 1),
      target: 1,
      unlocked: weekends > 0,
      count: weekends,
      note: null,
    },
    {
      id: 'mes-perfecto',
      name: 'Mes perfecto',
      emoji: '🗓️',
      description: 'Todos los días de un mes, perfectos',
      progress: perfectThisMonth,
      target: daysInMonth(currentMonth),
      unlocked: perfectMonths > 0,
      count: perfectMonths,
      note: brokenThisMonth ? 'Este mes ya se rompió: el 1 empieza otro intento' : null,
    },
    {
      id: 'cien',
      name: 'Cien',
      emoji: '💯',
      description: '100 hábitos cumplidos',
      progress: Math.min(totalDone, 100),
      target: 100,
      unlocked: totalDone >= 100,
      count: Math.floor(totalDone / 100),
      note: null,
    },
    {
      id: 'treinta-perfectos',
      name: 'Treinta perfectos',
      emoji: '💎',
      description: '30 días perfectos en total',
      progress: Math.min(perfectTotal, 30),
      target: 30,
      unlocked: perfectTotal >= 30,
      count: Math.floor(perfectTotal / 30),
      note: null,
    },
  ];
}
