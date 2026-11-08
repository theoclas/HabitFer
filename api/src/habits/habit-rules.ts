import { HabitKind, ScheduleType } from '@prisma/client';
import { addDays, parseDateKey, toDateKey, toIsoWeekday } from '../common/date.utils';

/**
 * Reglas de HabitFer en un solo lugar: que dia toca cada habito, que cuenta como hecho,
 * las rachas (en dias, en semanas o de dias limpio) y los retos. Todo con claves YYYY-MM-DD.
 *
 * - BUILD diario o con dias fijos: se pide en sus dias; si falta un dia pedido, se rompe la racha.
 * - BUILD "X veces por semana" (WEEKLY_COUNT): ningun dia se pide; la racha cuenta semanas cumplidas.
 * - QUIT (dejar algo): nada se marca; cuenta los dias limpio desde el inicio o la ultima recaida.
 * - Pausas y congeladores (skipKeys): esos dias no se piden, asi que no cuentan ni rompen.
 *   Si igual se cumple el habito ese dia, cuenta como hecho.
 */

export type StreakUnit = 'days' | 'weeks';

export type RuleHabit = {
  kind: HabitKind;
  scheduleType: ScheduleType;
  scheduleDays: unknown;
  weeklyTarget: number | null;
  streakEnabled: boolean;
  /** Primer dia que cuenta: creacion (o el primer completado si es anterior); en QUIT, el primer dia limpio. */
  startKey: string;
  /** BUILD: dias en que se llego a la meta. QUIT: dias de recaida. */
  doneKeys: ReadonlySet<string>;
  /** Dias en pausa o congelados. */
  skipKeys: ReadonlySet<string>;
};

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];
const MAX_SCAN_DAYS = 4000;
const MAX_SCAN_WEEKS = 600;
export const DEFAULT_WEEKLY_TARGET = 3;

export function parseScheduleDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [...ISO_DAYS];
  const days = value.filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 7);
  return days.length ? days : [...ISO_DAYS];
}

export function shiftKey(key: string, days: number): string {
  return toDateKey(addDays(parseDateKey(key), days));
}

/** Dias de `fromKey` a `toKey` (positivo si `toKey` es despues). */
export function diffDays(fromKey: string, toKey: string): number {
  return Math.round((parseDateKey(toKey).getTime() - parseDateKey(fromKey).getTime()) / 86_400_000);
}

/** Lunes de la semana (ISO) de ese dia. */
export function weekStartKey(key: string): string {
  return shiftKey(key, 1 - toIsoWeekday(parseDateKey(key)));
}

export function weeklyTargetOf(h: Pick<RuleHabit, 'weeklyTarget'>): number {
  const t = h.weeklyTarget ?? DEFAULT_WEEKLY_TARGET;
  return Math.min(7, Math.max(1, Math.round(t)));
}

export function streakUnit(h: Pick<RuleHabit, 'kind' | 'scheduleType'>): StreakUnit {
  return h.kind === HabitKind.BUILD && h.scheduleType === ScheduleType.WEEKLY_COUNT ? 'weeks' : 'days';
}

/** El habito aparece ese dia (se puede marcar). */
export function isPlannedOn(h: Pick<RuleHabit, 'kind' | 'scheduleType' | 'scheduleDays'>, key: string): boolean {
  if (h.kind === HabitKind.QUIT) return true;
  if (h.scheduleType === ScheduleType.WEEKLY) {
    return parseScheduleDays(h.scheduleDays).includes(toIsoWeekday(parseDateKey(key)));
  }
  return true;
}

/** Ese dia el habito se debia cumplir: cuenta para el dia perfecto y, si falta, rompe la racha. */
export function isRequiredOn(h: RuleHabit, key: string): boolean {
  if (h.kind !== HabitKind.BUILD || h.scheduleType === ScheduleType.WEEKLY_COUNT) return false;
  if (key < h.startKey || h.skipKeys.has(key)) return false;
  return isPlannedOn(h, key);
}

/** Se cumplio ese dia (solo BUILD; en QUIT los doneKeys son recaidas). */
export function isDoneOn(h: RuleHabit, key: string): boolean {
  return h.kind === HabitKind.BUILD && h.doneKeys.has(key) && isPlannedOn(h, key);
}

/** Cuenta en los totales del dia: lo que se pedia, mas lo flexible que si se hizo. */
export function countsOn(h: RuleHabit, key: string): boolean {
  return isRequiredOn(h, key) || isDoneOn(h, key);
}

// ---------- Rachas en dias ----------

function dayStreakAt(h: RuleHabit, refKey: string): number {
  let streak = 0;
  let key = refKey;
  for (let i = 0; i < MAX_SCAN_DAYS && key >= h.startKey; i++) {
    if (isDoneOn(h, key)) streak++;
    // Un dia pedido sin cumplir rompe la racha; el dia de referencia aun puede cumplirse.
    else if (isRequiredOn(h, key) && key !== refKey) break;
    key = shiftKey(key, -1);
  }
  return streak;
}

/** Racha que tenia el habito en cada dia cumplido, en orden (para los bonos de XP). */
export function runningStreaks(h: RuleHabit, todayKey: string): { key: string; streak: number }[] {
  const out: { key: string; streak: number }[] = [];
  if (h.kind !== HabitKind.BUILD) return out;
  const byWeek = streakUnit(h) === 'weeks';
  let current = 0;
  let key = h.startKey;
  for (let i = 0; i < MAX_SCAN_DAYS && key <= todayKey; i++) {
    if (isDoneOn(h, key)) {
      current++;
      out.push({ key, streak: byWeek ? 0 : current });
    } else if (isRequiredOn(h, key) && key !== todayKey) {
      current = 0;
    }
    key = shiftKey(key, 1);
  }
  return out;
}

function longestDayStreak(h: RuleHabit, todayKey: string): number {
  let best = 0;
  for (const { streak } of runningStreaks(h, todayKey)) best = Math.max(best, streak);
  return best;
}

// ---------- Rachas en semanas (X veces por semana) ----------

/** Veces cumplidas en la semana que empieza en `weekStart`, sin pasar de `untilKey`. */
export function weekDoneCount(h: RuleHabit, weekStart: string, untilKey = '9999-12-31'): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const key = shiftKey(weekStart, i);
    if (key > untilKey) break;
    if (h.doneKeys.has(key)) n++;
  }
  return n;
}

function weekHasSkip(h: RuleHabit, weekStart: string): boolean {
  for (let i = 0; i < 7; i++) if (h.skipKeys.has(shiftKey(weekStart, i))) return true;
  return false;
}

type WeekOutcome = 'met' | 'neutral' | 'missed';

/**
 * Una semana cumple si llega a la meta. Si no llega pero es la semana en curso, la primera
 * (incompleta, porque el habito empezo a mitad de semana) o tuvo dias en pausa, no rompe.
 */
function weekOutcome(h: RuleHabit, weekStart: string, refKey: string): WeekOutcome {
  if (weekDoneCount(h, weekStart, refKey) >= weeklyTargetOf(h)) return 'met';
  const current = weekStartKey(refKey);
  if (weekStart === current || weekStart <= h.startKey || weekHasSkip(h, weekStart)) return 'neutral';
  return 'missed';
}

function weekStreakAt(h: RuleHabit, refKey: string): number {
  let streak = 0;
  let ws = weekStartKey(refKey);
  for (let i = 0; i < MAX_SCAN_WEEKS; i++) {
    if (shiftKey(ws, 6) < h.startKey) break;
    const outcome = weekOutcome(h, ws, refKey);
    if (outcome === 'met') streak++;
    else if (outcome === 'missed') break;
    ws = shiftKey(ws, -7);
  }
  return streak;
}

function longestWeekStreak(h: RuleHabit, todayKey: string): number {
  let best = 0;
  let current = 0;
  const last = weekStartKey(todayKey);
  let ws = weekStartKey(h.startKey);
  for (let i = 0; i < MAX_SCAN_WEEKS && ws <= last; i++) {
    const outcome = weekOutcome(h, ws, todayKey);
    if (outcome === 'met') current++;
    else if (outcome === 'missed') current = 0;
    best = Math.max(best, current);
    ws = shiftKey(ws, 7);
  }
  return best;
}

// ---------- Dias limpio (dejar algo) ----------

function relapsesUntil(h: RuleHabit, refKey: string): string[] {
  return [...h.doneKeys].filter((k) => k >= h.startKey && k <= refKey).sort();
}

/** Dias completos limpio a `refKey`: desde el inicio o desde el dia siguiente a la ultima recaida. */
export function cleanDays(h: RuleHabit, refKey: string): number {
  const relapses = relapsesUntil(h, refKey);
  const last = relapses[relapses.length - 1];
  const anchor = last ? shiftKey(last, 1) : h.startKey;
  return Math.max(0, diffDays(anchor < h.startKey ? h.startKey : anchor, refKey));
}

function longestClean(h: RuleHabit, todayKey: string): number {
  let best = 0;
  let anchor = h.startKey;
  for (const r of relapsesUntil(h, todayKey)) {
    best = Math.max(best, diffDays(anchor, r));
    anchor = shiftKey(r, 1);
  }
  return Math.max(best, diffDays(anchor, todayKey), 0);
}

// ---------- Racha publica ----------

/** Racha actual en su unidad (dias, semanas o dias limpio). Sin racha activada, 0 (salvo QUIT). */
export function currentStreak(h: RuleHabit, refKey: string): number {
  if (h.kind === HabitKind.QUIT) return cleanDays(h, refKey);
  if (!h.streakEnabled) return 0;
  return streakUnit(h) === 'weeks' ? weekStreakAt(h, refKey) : dayStreakAt(h, refKey);
}

export function longestStreak(h: RuleHabit, todayKey: string): number {
  if (h.kind === HabitKind.QUIT) return longestClean(h, todayKey);
  if (!h.streakEnabled) return 0;
  return streakUnit(h) === 'weeks' ? longestWeekStreak(h, todayKey) : longestDayStreak(h, todayKey);
}

// ---------- Retos ----------

export type ChallengeStatus = 'upcoming' | 'active' | 'won' | 'broken';

export type ChallengeState = {
  startKey: string;
  endKey: string;
  days: number;
  /** Dia del reto en que va (1 a `days`); 0 si aun no empieza. */
  dayIndex: number;
  /** Avance: dias pedidos cumplidos, veces hechas o dias limpio, sobre `total`. */
  done: number;
  total: number;
  /** Dias que quedan, contando hoy. */
  remaining: number;
  status: ChallengeStatus;
  /** Primer dia que lo rompio (o el dia en que dejo de ser posible). */
  brokenOn: string | null;
};

/**
 * Estado de un reto de `days` dias que empieza en `startKey`:
 * - diario o con dias fijos: cumplir cada dia pedido (las pausas y los congeladores no se piden);
 * - X veces por semana: llegar a las veces que suman esas semanas;
 * - dejar algo: ni una recaida en todo el reto.
 */
export function evaluateChallenge(h: RuleHabit, startKey: string, days: number, todayKey: string): ChallengeState {
  const endKey = shiftKey(startKey, days - 1);
  const started = todayKey >= startKey;
  const dayIndex = started ? Math.min(days, diffDays(startKey, todayKey) + 1) : 0;
  const remaining = todayKey > endKey ? 0 : diffDays(started ? todayKey : startKey, endKey) + 1;
  const base = { startKey, endKey, days, dayIndex, remaining };
  const lastSeen = todayKey < endKey ? todayKey : endKey;

  if (h.kind === HabitKind.QUIT) {
    const relapse = started ? [...h.doneKeys].filter((k) => k >= startKey && k <= lastSeen).sort()[0] : undefined;
    const done = started ? Math.min(days, Math.max(0, diffDays(startKey, todayKey > endKey ? shiftKey(endKey, 1) : todayKey))) : 0;
    if (relapse) return { ...base, done, total: days, status: 'broken', brokenOn: relapse };
    return { ...base, done, total: days, status: todayKey > endKey ? 'won' : started ? 'active' : 'upcoming', brokenOn: null };
  }

  if (h.scheduleType === ScheduleType.WEEKLY_COUNT) {
    const total = Math.max(1, Math.ceil((days / 7) * weeklyTargetOf(h)));
    let done = 0;
    let left = 0;
    for (let i = 0; i < days; i++) {
      const key = shiftKey(startKey, i);
      if (key <= todayKey && h.doneKeys.has(key)) done++;
      else if (key >= todayKey) left++;
    }
    if (done >= total) return { ...base, done: total, total, status: 'won', brokenOn: null };
    if (done + left < total) return { ...base, done, total, status: 'broken', brokenOn: lastSeen };
    return { ...base, done, total, status: started ? 'active' : 'upcoming', brokenOn: null };
  }

  let total = 0;
  let done = 0;
  let brokenOn: string | null = null;
  for (let i = 0; i < days; i++) {
    const key = shiftKey(startKey, i);
    const required = isRequiredOn(h, key);
    if (isDoneOn(h, key)) {
      done++;
      if (!required) continue;
    }
    if (!required) continue;
    total++;
    if (!brokenOn && key < todayKey && !isDoneOn(h, key)) brokenOn = key;
  }
  if (brokenOn) return { ...base, done: Math.min(done, total), total, status: 'broken', brokenOn };
  const won = total > 0 ? done >= total : todayKey > endKey;
  return { ...base, done: Math.min(done, Math.max(total, 1)), total, status: won ? 'won' : started ? 'active' : 'upcoming', brokenOn: null };
}

/** Dias (claves) entre dos fechas, ambas incluidas, con tope. */
export function keysBetween(fromKey: string, toKey: string, max = 400): string[] {
  const out: string[] = [];
  let key = fromKey;
  for (let i = 0; i < max && key <= toKey; i++) {
    out.push(key);
    key = shiftKey(key, 1);
  }
  return out;
}
