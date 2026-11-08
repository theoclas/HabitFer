import { BadRequestException } from '@nestjs/common';
import { HabitKind, Prisma, ScheduleType, TimeOfDay, type Habit } from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date.utils';
import { habitReminderTimes, normalizeReminderTimes } from '../reminders/reminder-text.utils';
import { pauseOn, toHistoryHabit, type PauseRange } from '../stats/history.utils';
import {
  DEFAULT_WEEKLY_TARGET,
  currentStreak,
  diffDays,
  evaluateChallenge,
  isPlannedOn,
  isRequiredOn,
  longestStreak,
  parseScheduleDays,
  streakUnit,
  weekDoneCount,
  weeklyTargetOf,
  weekStartKey,
} from './habit-rules';

/** Todo lo que necesitan las reglas de un habito. */
export const HABIT_FULL_INCLUDE = {
  completions: { select: { date: true, createdAt: true, note: true } },
  relapses: { select: { date: true, note: true } },
  freezes: { select: { date: true } },
} satisfies Prisma.HabitInclude;

export type HabitFull = Prisma.HabitGetPayload<{ include: typeof HABIT_FULL_INCLUDE }>;

export type DayProgress = { value: number; note: string | null };

export type ViewContext = {
  /** Dia que se esta mirando (hoy, o el elegido en la semana de Hoy). */
  refKey: string;
  todayKey: string;
  pauses: PauseRange[];
  /** Cantidad de ese dia por habito (solo medibles). */
  progress: Map<string, DayProgress>;
};

/** Lo que la app necesita de un habito, mirado en `ctx.refKey`. */
export function habitView(h: HabitFull, ctx: ViewContext) {
  const hist = toHistoryHabit(h, ctx.pauses);
  const { refKey, todayKey } = ctx;
  const isQuit = h.kind === HabitKind.QUIT;
  const weekly = !isQuit && h.scheduleType === ScheduleType.WEEKLY_COUNT;
  const completion = isQuit ? undefined : h.completions.find((c) => toDateKey(c.date) === refKey);
  const relapse = isQuit ? h.relapses.find((r) => toDateKey(r.date) === refKey) : undefined;
  const progress = ctx.progress.get(h.id);
  const goal = Math.max(1, h.goal);
  const pause = pauseOn(h.id, ctx.pauses, refKey);

  return {
    id: h.id,
    title: h.title,
    description: h.description,
    color: h.color,
    icon: h.icon,
    archived: h.archived,
    kind: h.kind,
    scheduleType: h.scheduleType,
    scheduleDays: parseScheduleDays(h.scheduleDays),
    weeklyTarget: weekly ? weeklyTargetOf(h) : null,
    timeOfDay: h.timeOfDay,
    streakEnabled: h.streakEnabled,
    goal,
    unit: h.unit,
    step: Math.max(1, h.step),
    /** QUIT: primer dia limpio. */
    startDate: isQuit ? hist.startKey : null,
    reminderEnabled: h.reminderEnabled,
    reminderTime: h.reminderTime,
    reminderTimes: habitReminderTimes(h),
    /** Se marca solo desde NutriFer (null = a mano). */
    autoSource: h.autoSource ?? null,
    sortOrder: h.sortOrder,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    streakUnit: streakUnit(h),
    currentStreak: currentStreak(hist, refKey),
    longestStreak: longestStreak(hist, todayKey),
    /** Se llego a la meta ese dia. */
    completedToday: Boolean(completion),
    /** Aparece ese dia (se puede marcar). */
    scheduledToday: isPlannedOn(hist, refKey),
    /** Ese dia se pedia: cuenta para el dia perfecto. */
    requiredToday: isRequiredOn(hist, refKey),
    /** Cantidad del dia (medibles); en los si/no, 1 si esta hecho. */
    valueToday: isQuit ? 0 : progress ? progress.value : completion ? goal : 0,
    /** X veces por semana: veces hechas en la semana de ese dia. */
    weekDone: weekly ? weekDoneCount(hist, weekStartKey(refKey), refKey) : null,
    relapsedToday: Boolean(relapse),
    frozenToday: h.freezes.some((f) => toDateKey(f.date) === refKey),
    /** Ultimo dia de la pausa que cubre ese dia (del habito o de todos). A dejar algo no le afecta. */
    pausedUntil: pause && !isQuit ? pause.endKey : null,
    challenge:
      h.challengeDays && h.challengeStart ? evaluateChallenge(hist, toDateKey(h.challengeStart), h.challengeDays, todayKey) : null,
    note: completion?.note ?? progress?.note ?? relapse?.note ?? null,
  };
}

export type HabitView = ReturnType<typeof habitView>;

// ---------- Crear y editar ----------

export type HabitInput = {
  title?: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
  kind?: HabitKind;
  scheduleType?: ScheduleType;
  scheduleDays?: number[];
  weeklyTarget?: number | null;
  timeOfDay?: TimeOfDay;
  streakEnabled?: boolean;
  goal?: number;
  unit?: string | null;
  step?: number;
  startDate?: string | null;
  challengeDays?: number | null;
  challengeStart?: string | null;
  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderTimes?: string[];
  archived?: boolean;
};

const MAX_GOAL = 100_000;
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Datos completos para crear o editar un habito, con las reglas de cada tipo aplicadas:
 * - dejar algo: diario, sin meta, sin avisos, con primer dia limpio (hoy o antes);
 * - X veces por semana: meta de 1 a 7 y todos los dias disponibles;
 * - medible: meta mayor que 1, unidad opcional y cuanto suma cada toque (hasta la meta);
 * - reto: de 3 a 365 dias, desde hoy salvo que se diga otra fecha.
 * El tipo (hacer o dejar) no se cambia despues de creado.
 */
export function habitData(input: HabitInput, existing: Habit | null, todayKey: string) {
  if (existing && input.kind && input.kind !== existing.kind) {
    throw new BadRequestException('Un hábito no puede cambiar de tipo: crea uno nuevo.');
  }
  const kind = existing?.kind ?? input.kind ?? HabitKind.BUILD;
  const isQuit = kind === HabitKind.QUIT;

  const scheduleType = isQuit ? ScheduleType.DAILY : (input.scheduleType ?? existing?.scheduleType ?? ScheduleType.DAILY);
  const scheduleDays =
    scheduleType === ScheduleType.WEEKLY ? parseScheduleDays(input.scheduleDays ?? existing?.scheduleDays) : ALL_DAYS;
  const weeklyTarget =
    scheduleType === ScheduleType.WEEKLY_COUNT
      ? clampInt(input.weeklyTarget ?? existing?.weeklyTarget ?? DEFAULT_WEEKLY_TARGET, 1, 7)
      : null;

  const goal = isQuit ? 1 : clampInt(input.goal ?? existing?.goal ?? 1, 1, MAX_GOAL);
  const unitRaw = input.unit !== undefined ? input.unit : (existing?.unit ?? null);
  const unit = goal > 1 ? unitRaw?.trim().slice(0, 20) || null : null;
  const step = goal > 1 ? clampInt(input.step ?? existing?.step ?? 1, 1, goal) : 1;

  let startDate: Date | null = null;
  if (isQuit) {
    const key = input.startDate ?? (existing?.startDate ? toDateKey(existing.startDate) : todayKey);
    if (key > todayKey) throw new BadRequestException('El primer día limpio no puede ser en el futuro.');
    if (diffDays(key, todayKey) > 3650) throw new BadRequestException('El primer día limpio puede ser hasta hace 10 años.');
    startDate = parseDateKey(key);
  }

  let challengeDays = existing?.challengeDays ?? null;
  let challengeStart = existing?.challengeStart ? toDateKey(existing.challengeStart) : null;
  if (input.challengeDays === null) {
    challengeDays = null;
  } else if (input.challengeDays !== undefined) {
    challengeDays = clampInt(input.challengeDays, 3, 365);
  }
  if (!challengeDays) {
    challengeStart = null;
  } else {
    challengeStart = input.challengeStart ?? challengeStart ?? todayKey;
    if (Math.abs(diffDays(todayKey, challengeStart)) > 60) {
      throw new BadRequestException('El reto puede empezar hasta 60 días antes o después de hoy.');
    }
  }

  const reminderEnabled = !isQuit && (input.reminderEnabled ?? existing?.reminderEnabled ?? false);
  const times = input.reminderTimes ?? (input.reminderTime ? [input.reminderTime] : existing ? habitReminderTimes(existing) : []);
  const reminderList = reminderEnabled ? normalizeReminderTimes(times) : [];

  const title = input.title?.trim() || existing?.title;
  if (!title) throw new BadRequestException('Escribe un título');

  return {
    title,
    description: input.description !== undefined ? input.description?.trim() || null : (existing?.description ?? null),
    color: input.color ?? existing?.color ?? '#22d3ee',
    icon: input.icon !== undefined ? input.icon?.trim() || null : (existing?.icon ?? null),
    kind,
    scheduleType,
    scheduleDays,
    weeklyTarget,
    timeOfDay: input.timeOfDay ?? existing?.timeOfDay ?? TimeOfDay.ANYTIME,
    streakEnabled: isQuit ? true : (input.streakEnabled ?? existing?.streakEnabled ?? true),
    goal,
    unit,
    step,
    startDate,
    challengeDays,
    challengeStart: challengeStart ? parseDateKey(challengeStart) : null,
    reminderEnabled: reminderEnabled && reminderList.length > 0,
    reminderTime: reminderList[0] ?? null,
    reminderTimes: reminderList,
    archived: input.archived ?? existing?.archived ?? false,
  };
}
