import { HabitKind, ScheduleType } from '@prisma/client';
import { parseDateKey, toIsoWeekday } from '../common/date.utils';
import { getNextMilestone } from '../habits/achievements.utils';
import {
  cleanDays,
  currentStreak,
  diffDays,
  isDoneOn,
  isRequiredOn,
  longestStreak,
  shiftKey,
  streakUnit,
} from '../habits/habit-rules';
import { buildDays, byHour, byWeekday, earliestKey, eachDayKey, moodSummary, ranking, type HistoryHabit } from './history.utils';

/**
 * Insights: frases sacadas del historial con reglas simples (sin IA). Cada una dice algo
 * concreto con numeros y, si es un consejo, que hacer.
 */
export type Insight = {
  id: string;
  emoji: string;
  title: string;
  text: string;
  /** good = algo que va bien, tip = algo para mejorar, info = un dato curioso. */
  tone: 'good' | 'tip' | 'info';
  habitId?: string;
  /** Para ordenar: mas alto = mas relevante. */
  score: number;
};

const WEEKDAY_PLURAL = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function pct(done: number, total: number): number {
  return total ? Math.round((done / total) * 100) : 0;
}

function hourRange(h: number): string {
  const period = (x: number) => (x < 12 ? 'a. m.' : 'p. m.');
  const h12 = (x: number) => (x % 12 === 0 ? 12 : x % 12);
  const next = (h + 1) % 24;
  return period(h) === period(next) ? `${h12(h)} a ${h12(next)} ${period(h)}` : `${h12(h)} ${period(h)} a ${h12(next)} ${period(next)}`;
}

function weekday(key: string): number {
  return toIsoWeekday(parseDateKey(key));
}

/** Dias seguidos (hacia atras desde `untilKey`) que se pedian y no se cumplieron. */
function missedRun(h: HistoryHabit, untilKey: string): number {
  let n = 0;
  let key = untilKey;
  for (let i = 0; i < 120 && key >= h.startKey; i++) {
    if (isDoneOn(h, key)) break;
    if (isRequiredOn(h, key)) n++;
    key = shiftKey(key, -1);
  }
  return n;
}

const LOOKBACK_DAYS = 56;

export function computeInsights(habits: HistoryHabit[], moods: Map<string, number>, todayKey: string, limit = 6): Insight[] {
  const out: Insight[] = [];
  const yesterday = shiftKey(todayKey, -1);
  const from = shiftKey(todayKey, -LOOKBACK_DAYS);
  const build = habits.filter((h) => h.kind === HabitKind.BUILD);
  const daily = build.filter((h) => h.scheduleType !== ScheduleType.WEEKLY_COUNT);

  // 1. El dia de la semana en que mas cuesta cada habito.
  for (const h of daily) {
    const per = Array.from({ length: 8 }, () => ({ req: 0, done: 0 }));
    let req = 0;
    let done = 0;
    for (const key of eachDayKey(from > h.startKey ? from : h.startKey, yesterday)) {
      if (!isRequiredOn(h, key)) continue;
      const wd = weekday(key);
      per[wd].req++;
      req++;
      if (isDoneOn(h, key)) {
        per[wd].done++;
        done++;
      }
    }
    if (req < 20) continue;
    let worst = 0;
    let worstRate = 101;
    for (let wd = 1; wd <= 7; wd++) {
      if (per[wd].req < 4) continue;
      const r = pct(per[wd].done, per[wd].req);
      if (r < worstRate) {
        worstRate = r;
        worst = wd;
      }
    }
    if (!worst) continue;
    const rest = pct(done - per[worst].done, req - per[worst].req);
    if (rest - worstRate >= 25 && worstRate < 75) {
      out.push({
        id: `weekday-weak:${h.id}`,
        emoji: '📅',
        tone: 'tip',
        habitId: h.id,
        title: `Los ${WEEKDAY_PLURAL[worst]} te cuesta «${h.title}»`,
        text: `Ese día lo cumples el ${worstRate} %; el resto de la semana, el ${rest} %. Prueba moverle la hora o ponerle un aviso solo ese día.`,
        score: 50 + (rest - worstRate),
      });
    }
  }

  // 2. Tu mejor dia de la semana.
  const days = buildDays(habits, from, yesterday);
  const weekdays = byWeekday(days).filter((r) => r.scheduled >= 8);
  if (weekdays.length >= 5) {
    const avg = pct(
      weekdays.reduce((s, r) => s + r.completed, 0),
      weekdays.reduce((s, r) => s + r.scheduled, 0),
    );
    const best = weekdays.reduce((a, b) => (b.rate > a.rate ? b : a));
    if (best.rate >= 80 && best.rate - avg >= 8) {
      out.push({
        id: 'weekday-best',
        emoji: '💪',
        tone: 'good',
        title: `Los ${WEEKDAY_PLURAL[best.weekday]} son tu mejor día`,
        text: `Cumples el ${best.rate} %, frente a un ${avg} % de promedio.`,
        score: 30 + best.rate - avg,
      });
    }
  }

  // 3. A que hora cumples.
  const hours = byHour(habits, from, todayKey);
  const marks = hours.reduce((s, x) => s + x, 0);
  if (marks >= 15) {
    const earlyPct = pct(hours.slice(0, 9).reduce((s, x) => s + x, 0), marks);
    if (earlyPct >= 50) {
      out.push({
        id: 'hour-early',
        emoji: '🌅',
        tone: 'good',
        title: 'Eres de mañana',
        text: `El ${earlyPct} % de lo que marcas lo haces antes de las 9 a. m.`,
        score: 25 + Math.round(earlyPct / 4),
      });
    } else {
      const peak = hours.indexOf(Math.max(...hours));
      const peakPct = pct(hours[peak], marks);
      if (peakPct >= 20) {
        out.push({
          id: 'hour-peak',
          emoji: '⏰',
          tone: 'info',
          title: `Tu hora fuerte: de ${hourRange(peak)}`,
          text: `Ahí cae el ${peakPct} % de lo que marcas. Si algo se te escapa, ponle el aviso a esa hora.`,
          score: 20 + Math.round(peakPct / 4),
        });
      }
    }
  }

  // 4. Tu mejor mes (solo meses terminados y con datos).
  const currentMonth = todayKey.slice(0, 7);
  const byMonth = new Map<string, { scheduled: number; completed: number; active: number }>();
  for (const d of buildDays(habits, earliestKey(habits, todayKey), yesterday)) {
    const m = d.date.slice(0, 7);
    if (m === currentMonth || d.scheduled === 0) continue;
    const acc = byMonth.get(m) ?? { scheduled: 0, completed: 0, active: 0 };
    acc.scheduled += d.scheduled;
    acc.completed += d.completed;
    acc.active++;
    byMonth.set(m, acc);
  }
  const months = [...byMonth].filter(([, v]) => v.active >= 15).map(([m, v]) => ({ m, rate: pct(v.completed, v.scheduled) }));
  if (months.length >= 2) {
    const best = months.reduce((a, b) => (b.rate > a.rate ? b : a));
    const name = MONTHS[Number(best.m.slice(5, 7)) - 1];
    out.push({
      id: 'best-month',
      emoji: '🏆',
      tone: 'good',
      title: `Tu mejor mes fue ${name}`,
      text: `Cumpliste el ${best.rate} % de lo que tocaba. Esa es la vara.`,
      score: 20,
    });
  }

  // 5. Esta semana contra la anterior.
  const last = buildDays(habits, shiftKey(todayKey, -7), yesterday);
  const prev = buildDays(habits, shiftKey(todayKey, -14), shiftKey(todayKey, -8));
  const lastS = last.reduce((s, d) => s + d.scheduled, 0);
  const prevS = prev.reduce((s, d) => s + d.scheduled, 0);
  if (lastS >= 7 && prevS >= 7) {
    const r1 = pct(last.reduce((s, d) => s + d.completed, 0), lastS);
    const r0 = pct(prev.reduce((s, d) => s + d.completed, 0), prevS);
    if (r1 - r0 >= 10) {
      out.push({
        id: 'trend-up',
        emoji: '📈',
        tone: 'good',
        title: 'Vas mejor que la semana pasada',
        text: `${r1} % estos 7 días, frente a ${r0} % los 7 anteriores. Así se construye.`,
        score: 40 + (r1 - r0),
      });
    } else if (r0 - r1 >= 10) {
      out.push({
        id: 'trend-down',
        emoji: '🧭',
        tone: 'tip',
        title: 'Esta semana bajaste un poco',
        text: `${r1} % estos 7 días, frente a ${r0} % la anterior. Elige uno solo para mañana y no lo sueltes.`,
        score: 45 + (r0 - r1),
      });
    }
  }

  // 6. Una medalla a punto de caer (la mas cercana).
  let near: Insight | null = null;
  for (const h of habits) {
    const quit = h.kind === HabitKind.QUIT;
    if (!quit && !h.streakEnabled) continue;
    const current = currentStreak(h, todayKey);
    const next = getNextMilestone(current);
    if (!next || current < 1) continue;
    const remaining = next - current;
    if (remaining > 2) continue;
    const unit = quit ? (remaining === 1 ? 'día limpio' : 'días limpio') : streakUnit(h) === 'weeks' ? (remaining === 1 ? 'semana' : 'semanas') : remaining === 1 ? 'día' : 'días';
    const candidate: Insight = {
      id: `milestone-near:${h.id}`,
      emoji: '🎯',
      tone: 'good',
      habitId: h.id,
      title: `${remaining === 1 ? 'Te falta' : 'Te faltan'} ${remaining} ${unit} para una medalla`,
      text: `«${h.title}» llega a ${next}${quit ? ' días limpio' : streakUnit(h) === 'weeks' ? ' semanas' : ' días'}. No la sueltes ahora.`,
      score: 60 - remaining * 5 + Math.min(10, Math.round(current / 10)),
    };
    if (!near || candidate.score > near.score) near = candidate;
  }
  if (near) out.push(near);

  // 7. Tu habito mas firme (ultimos 30 dias).
  const star = ranking(habits, shiftKey(todayKey, -30), yesterday).find((r) => r.scheduled >= 10);
  if (star && star.rate >= 90) {
    out.push({
      id: `star:${star.id}`,
      emoji: '⭐',
      tone: 'good',
      habitId: star.id,
      title: `«${star.title}» es tu hábito más firme`,
      text: `${star.rate} % en los últimos 30 días. Úsalo de ancla: pega otro hábito justo después.`,
      score: 26,
    });
  }

  // 8. Un habito que lleva dias sin marcarse.
  let worstMissed: Insight | null = null;
  for (const h of daily) {
    if (diffDays(h.startKey, todayKey) < 10) continue;
    const n = missedRun(h, yesterday);
    if (n < 7) continue;
    const candidate: Insight = {
      id: `neglected:${h.id}`,
      emoji: '🪫',
      tone: 'tip',
      habitId: h.id,
      title: `«${h.title}» lleva ${n} días sin marcarse`,
      text: 'Puedes bajarle la frecuencia, pausarlo o archivarlo: pocos hábitos bien hechos valen más.',
      score: 55 + Math.min(30, n),
    };
    if (!worstMissed || candidate.score > worstMissed.score) worstMissed = candidate;
  }
  if (worstMissed) out.push(worstMissed);

  // 9. Animo y constancia.
  const recentMoods = new Map([...moods].filter(([k]) => k >= from && k <= todayKey));
  const mood = moodSummary(days, recentMoods);
  if (mood.entries >= 6 && mood.highRate !== null && mood.lowRate !== null && mood.highRate - mood.lowRate >= 20) {
    out.push({
      id: 'mood',
      emoji: '🌤️',
      tone: 'info',
      title: 'Tu ánimo y tus hábitos van juntos',
      text: `En días buenos cumples el ${mood.highRate} %; en días difíciles, el ${mood.lowRate} %. En los días grises, un hábito pequeño también cuenta.`,
      score: 22,
    });
  }

  // 10. Dejar algo: record o cerca del record.
  for (const h of habits.filter((x) => x.kind === HabitKind.QUIT)) {
    const current = cleanDays(h, todayKey);
    const best = longestStreak(h, todayKey);
    const hadRelapse = [...h.doneKeys].some((k) => k >= h.startKey && k <= todayKey);
    if (hadRelapse && current >= 7 && current >= best) {
      out.push({
        id: `quit-record:${h.id}`,
        emoji: '🥇',
        tone: 'good',
        habitId: h.id,
        title: `Récord en «${h.title}»`,
        text: `${current} días limpio: tu mejor marca. Cada día que sumas ahora es terreno nuevo.`,
        score: 58,
      });
    } else if (best > current && best - current <= 3 && current >= 3) {
      out.push({
        id: `quit-near:${h.id}`,
        emoji: '🔥',
        tone: 'good',
        habitId: h.id,
        title: `Estás a ${best - current} ${best - current === 1 ? 'día' : 'días'} de tu récord`,
        text: `En «${h.title}» llevas ${current} días limpio; tu mejor marca es ${best}.`,
        score: 52,
      });
    }
  }

  // 11. Dias perfectos este mes.
  const monthDays = buildDays(habits, `${currentMonth}-01`, todayKey);
  const perfectNow = monthDays.filter((d) => d.perfect).length;
  if (perfectNow >= 3) {
    out.push({
      id: 'perfect-month',
      emoji: '💎',
      tone: 'info',
      title: `Llevas ${perfectNow} días perfectos este mes`,
      text: 'Un día perfecto es cuando cumples todo lo que tocaba. Van sumando.',
      score: 15 + perfectNow,
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
