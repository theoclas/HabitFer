import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HabitKind, Prisma, ScheduleType, type ChallengeResult, type Habit } from '@prisma/client';
import { randomInt } from 'crypto';
import { isCompletableDate, localDateKey, parseDateKey, startOfToday, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { loadHistory, loadPauses } from '../stats/history.loader';
import { buildDays, earliestKey, toHistoryHabit, type PauseRange } from '../stats/history.utils';
import { computeProgress } from '../stats/progress.utils';
import {
  getNextMilestone,
  getStreakMilestones,
  isStreakMilestone,
  milestoneHeadline,
  milestoneLabelFor,
  PHRASE_COUNT,
  type MilestoneKind,
} from './achievements.utils';
import { CompleteHabitDto } from './dto/complete-habit.dto';
import { CreateHabitDto } from './dto/create-habit.dto';
import { CreatePauseDto, RelapseDto, SetProgressDto } from './dto/habit-actions.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import {
  cleanDays,
  currentStreak,
  diffDays,
  evaluateChallenge,
  isPlannedOn,
  isRequiredOn,
  longestStreak,
  shiftKey,
  streakUnit,
  type ChallengeState,
} from './habit-rules';
import { HABIT_FULL_INCLUDE, habitData, habitView, type DayProgress, type HabitFull } from './habit-view';
import { computeSpecials } from './specials.utils';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const FREEZE_WINDOW_DAYS = 7;
const RELAPSE_WINDOW_DAYS = 30;
const PAUSE_BACK_DAYS = 7;
const PAUSE_MAX_DAYS = 90;
const MAX_VALUE = 100_000;

/** Logro listo para celebrar en la app (racha, semanas, dias limpio o reto cumplido). */
export type AchievementPayload = {
  id: string;
  habitId: string;
  milestoneDays: number;
  phraseIndex: number;
  unlockedAt: Date;
  habitTitle: string;
  habitColor: string;
  habitIcon: string | null;
  label: string;
  headline: string;
  kind: MilestoneKind | 'challenge';
};

type Celebration = { unlockedAchievement?: AchievementPayload; challengeWon?: AchievementPayload };

type HabitLike = Pick<Habit, 'id' | 'title' | 'color' | 'icon' | 'kind' | 'scheduleType'>;

@Injectable()
export class HabitsService {
  constructor(private prisma: PrismaService) {}

  private todayKey(): string {
    return toDateKey(startOfToday());
  }

  // ---------- Carga y vistas ----------

  private findFull(where: Prisma.HabitWhereInput): Promise<HabitFull[]> {
    return this.prisma.habit.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: HABIT_FULL_INCLUDE,
    });
  }

  private async findOneFull(userId: string, id: string): Promise<HabitFull> {
    const habit = await this.prisma.habit.findFirst({ where: { id, userId }, include: HABIT_FULL_INCLUDE });
    if (!habit) throw new NotFoundException('Habito no encontrado');
    return habit;
  }

  private async progressOn(userId: string, key: string): Promise<Map<string, DayProgress>> {
    const rows = await this.prisma.habitProgress.findMany({
      where: { userId, date: parseDateKey(key) },
      select: { habitId: true, value: true, note: true },
    });
    return new Map(rows.map((r) => [r.habitId, { value: r.value, note: r.note }]));
  }

  private async viewsOf(userId: string, habits: HabitFull[], refKey = this.todayKey()) {
    const [pauses, progress] = await Promise.all([loadPauses(this.prisma, userId), this.progressOn(userId, refKey)]);
    const ctx = { refKey, todayKey: this.todayKey(), pauses, progress };
    return habits.map((h) => habitView(h, ctx));
  }

  private milestoneKind(h: Pick<Habit, 'kind' | 'scheduleType'>): MilestoneKind {
    if (h.kind === HabitKind.QUIT) return 'clean';
    return streakUnit(h) === 'weeks' ? 'weeks' : 'days';
  }

  private achievementPayload(
    a: { id: string; habitId: string; milestoneDays: number; phraseIndex: number; unlockedAt: Date },
    h: HabitLike,
  ): AchievementPayload {
    const kind = this.milestoneKind(h);
    return {
      id: a.id,
      habitId: a.habitId,
      milestoneDays: a.milestoneDays,
      phraseIndex: a.phraseIndex,
      unlockedAt: a.unlockedAt,
      habitTitle: h.title,
      habitColor: h.color,
      habitIcon: h.icon,
      label: milestoneLabelFor(a.milestoneDays, kind),
      headline: milestoneHeadline(a.milestoneDays, kind),
      kind,
    };
  }

  private challengePayload(r: ChallengeResult, h: HabitLike): AchievementPayload {
    const label =
      h.kind === HabitKind.QUIT
        ? 'Sin una sola recaída'
        : h.scheduleType === ScheduleType.WEEKLY_COUNT
          ? 'Todas las veces que te propusiste'
          : 'Sin fallar ni un día';
    return {
      id: r.id,
      habitId: r.habitId,
      milestoneDays: r.days,
      phraseIndex: r.phraseIndex,
      unlockedAt: r.wonAt,
      habitTitle: h.title,
      habitColor: h.color,
      habitIcon: h.icon,
      label,
      headline: `Reto de ${r.days} días cumplido`,
      kind: 'challenge',
    };
  }

  /**
   * Lo que se gana con solo pasar el tiempo: retos cumplidos y medallas de dias limpio.
   * Se registra al mirar los habitos y se devuelve una vez para celebrarlo.
   */
  private async settle(userId: string, habits: HabitFull[], pauses: PauseRange[]): Promise<Map<string, Celebration>> {
    const todayKey = this.todayKey();
    const out = new Map<string, Celebration>();
    const quitIds = habits.filter((h) => h.kind === HabitKind.QUIT && !h.archived).map((h) => h.id);
    const have = quitIds.length
      ? await this.prisma.habitAchievement.findMany({
          where: { habitId: { in: quitIds } },
          select: { habitId: true, milestoneDays: true },
        })
      : [];
    const haveSet = new Set(have.map((a) => `${a.habitId}:${a.milestoneDays}`));

    for (const h of habits) {
      if (h.archived) continue;
      const hist = toHistoryHabit(h, pauses);
      if (h.challengeDays && h.challengeStart) {
        const state = evaluateChallenge(hist, toDateKey(h.challengeStart), h.challengeDays, todayKey);
        if (state.status === 'won') {
          const won = await this.recordChallengeWin(userId, h, state);
          h.challengeDays = null;
          h.challengeStart = null;
          if (won) out.set(h.id, { ...out.get(h.id), challengeWon: won });
        }
      }
      if (h.kind === HabitKind.QUIT) {
        const clean = cleanDays(hist, todayKey);
        const missing = getStreakMilestones().filter((m) => m <= clean && !haveSet.has(`${h.id}:${m}`));
        if (missing.length > 0) {
          await this.prisma.habitAchievement.createMany({
            data: missing.map((m) => ({ habitId: h.id, userId, milestoneDays: m, phraseIndex: randomInt(0, PHRASE_COUNT) })),
            skipDuplicates: true,
          });
          const top = await this.prisma.habitAchievement.findUnique({
            where: { habitId_milestoneDays: { habitId: h.id, milestoneDays: Math.max(...missing) } },
          });
          if (top) out.set(h.id, { ...out.get(h.id), unlockedAchievement: this.achievementPayload(top, h) });
        }
      }
    }
    return out;
  }

  private async recordChallengeWin(userId: string, h: HabitFull, state: ChallengeState): Promise<AchievementPayload | null> {
    let row: ChallengeResult | null = null;
    try {
      row = await this.prisma.challengeResult.create({
        data: {
          habitId: h.id,
          userId,
          days: state.days,
          startDate: parseDateKey(state.startKey),
          endDate: parseDateKey(state.endKey),
          phraseIndex: randomInt(0, PHRASE_COUNT),
        },
      });
    } catch (err) {
      // Ya estaba registrado (otra pestaña lo celebro primero).
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }
    await this.prisma.habit.update({ where: { id: h.id }, data: { challengeDays: null, challengeStart: null } });
    return row ? this.challengePayload(row, h) : null;
  }

  // ---------- Listas ----------

  async list(userId: string) {
    return this.viewsOf(userId, await this.findFull({ userId, archived: false }));
  }

  async listArchived(userId: string) {
    return this.viewsOf(userId, await this.findFull({ userId, archived: true }));
  }

  /** Lo que aparece en Hoy para ese dia (por defecto hoy), con lo que haya que celebrar. */
  async today(userId: string, dateKey?: string) {
    const todayKey = this.todayKey();
    const refKey = dateKey && DATE_KEY.test(dateKey) ? dateKey : todayKey;
    const habits = await this.findFull({ userId, archived: false });
    const pauses = await loadPauses(this.prisma, userId);
    const settled = refKey === todayKey ? await this.settle(userId, habits, pauses) : new Map<string, Celebration>();
    const progress = await this.progressOn(userId, refKey);
    const ctx = { refKey, todayKey, pauses, progress };
    return habits
      .filter((h) => isPlannedOn(h, refKey))
      .map((h) => ({ ...habitView(h, ctx), scheduledForDate: refKey, ...settled.get(h.id) }));
  }

  async getOne(userId: string, id: string) {
    const habit = await this.findOneFull(userId, id);
    const pauses = await loadPauses(this.prisma, userId);
    const settled = await this.settle(userId, [habit], pauses);
    const todayKey = this.todayKey();
    const [progressRows, wins] = await Promise.all([
      this.prisma.habitProgress.findMany({
        where: { habitId: id },
        orderBy: { date: 'desc' },
        take: 400,
        select: { date: true, value: true, note: true },
      }),
      this.prisma.challengeResult.findMany({ where: { habitId: id }, orderBy: { wonAt: 'desc' } }),
    ]);
    const todayRow = progressRows.find((p) => toDateKey(p.date) === todayKey);
    const progress = new Map<string, DayProgress>(todayRow ? [[id, { value: todayRow.value, note: todayRow.note }]] : []);
    const view = habitView(habit, { refKey: todayKey, todayKey, pauses, progress });

    const completionKeys = habit.completions.map((c) => toDateKey(c.date)).sort().reverse();
    const doneSet = new Set(completionKeys);
    const recentNotes = [
      ...habit.completions.map((c) => ({ date: toDateKey(c.date), note: c.note?.trim() ?? '' })),
      ...progressRows.filter((p) => !doneSet.has(toDateKey(p.date))).map((p) => ({ date: toDateKey(p.date), note: p.note?.trim() ?? '' })),
      ...habit.relapses.map((r) => ({ date: toDateKey(r.date), note: r.note?.trim() ?? '' })),
    ]
      .filter((n) => n.note)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    return {
      ...view,
      ...settled.get(id),
      totalCompletions: habit.completions.length,
      recentCompletions: completionKeys.slice(0, 120),
      recentNotes,
      /** Cantidades por dia (medibles). */
      amounts: progressRows.map((p) => ({ date: toDateKey(p.date), value: p.value })),
      relapses: habit.relapses
        .map((r) => ({ date: toDateKey(r.date), note: r.note }))
        .sort((a, b) => b.date.localeCompare(a.date)),
      freezeDates: habit.freezes.map((f) => toDateKey(f.date)).sort().reverse(),
      pauses: pauses.filter((p) => p.habitId === id || p.habitId === null),
      challengeWins: wins.map((w) => ({
        id: w.id,
        days: w.days,
        startDate: toDateKey(w.startDate),
        endDate: toDateKey(w.endDate),
        wonAt: w.wonAt,
      })),
    };
  }

  // ---------- Crear, editar, ordenar ----------

  private async nextSortOrder(userId: string): Promise<number> {
    const last = await this.prisma.habit.aggregate({ where: { userId }, _max: { sortOrder: true } });
    return (last._max.sortOrder ?? -1) + 1;
  }

  async create(userId: string, dto: CreateHabitDto) {
    const data = habitData(dto, null, this.todayKey());
    const habit = await this.prisma.habit.create({
      data: { userId, ...data, sortOrder: await this.nextSortOrder(userId) },
      include: HABIT_FULL_INCLUDE,
    });
    return (await this.viewsOf(userId, [habit]))[0];
  }

  /** Varios habitos de una plantilla, en orden, al final de la lista. */
  async createMany(userId: string, dtos: CreateHabitDto[]) {
    const todayKey = this.todayKey();
    const datas = dtos.map((dto) => habitData(dto, null, todayKey));
    const base = await this.nextSortOrder(userId);
    const created = await this.prisma.$transaction(
      datas.map((data, i) =>
        this.prisma.habit.create({ data: { userId, ...data, sortOrder: base + i }, include: HABIT_FULL_INCLUDE }),
      ),
    );
    return this.viewsOf(userId, created);
  }

  async update(userId: string, id: string, dto: UpdateHabitDto) {
    const existing = await this.ensureOwner(userId, id);
    const todayKey = this.todayKey();
    const data = habitData(dto, existing, todayKey);
    const habit = await this.prisma.habit.update({ where: { id }, data });
    if (habit.kind === HabitKind.BUILD && habit.goal > 1 && habit.goal !== existing.goal) {
      await this.resyncGoal(userId, habit, todayKey);
    }
    return (await this.viewsOf(userId, [await this.findOneFull(userId, id)]))[0];
  }

  /** Si cambia la meta, hoy y ayer se recalculan con la cantidad que ya tenian. */
  private async resyncGoal(userId: string, habit: Habit, todayKey: string) {
    for (const key of [todayKey, shiftKey(todayKey, -1)]) {
      const date = parseDateKey(key);
      const where = { habitId_date: { habitId: habit.id, date } };
      const p = await this.prisma.habitProgress.findUnique({ where });
      if (!p) continue;
      if (p.value >= habit.goal) {
        await this.prisma.habitCompletion.upsert({
          where,
          create: { habitId: habit.id, userId, date, note: p.note },
          update: {},
        });
        if (p.note) await this.prisma.habitProgress.update({ where, data: { note: null } });
      } else {
        const c = await this.prisma.habitCompletion.findUnique({ where });
        if (c) {
          await this.prisma.habitCompletion.delete({ where });
          if (c.note && !p.note) await this.prisma.habitProgress.update({ where, data: { note: c.note } });
        }
      }
    }
  }

  async reorder(userId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const owned = await this.prisma.habit.count({ where: { userId, id: { in: unique } } });
    if (owned !== unique.length) throw new BadRequestException('Hay hábitos que no son tuyos o ya no existen.');
    await this.prisma.$transaction(unique.map((id, i) => this.prisma.habit.update({ where: { id }, data: { sortOrder: i } })));
    return { ok: true };
  }

  async remove(userId: string, id: string) {
    await this.ensureOwner(userId, id);
    await this.prisma.habit.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- Marcar y cantidades ----------

  private assertMarkable(habit: Habit, date: Date) {
    if (!isCompletableDate(date)) throw new ForbiddenException('Solo puedes marcar habitos de hoy o de ayer');
    if (!isPlannedOn(habit, toDateKey(date))) throw new ForbiddenException('Este habito no esta programado para esa fecha');
  }

  private assertBuild(habit: Habit) {
    if (habit.kind === HabitKind.QUIT) {
      throw new BadRequestException('Este hábito es para dejar algo: ahí se registra una recaída, no se marca.');
    }
  }

  async complete(userId: string, id: string, dto: CompleteHabitDto) {
    const habit = await this.ensureOwner(userId, id);
    this.assertBuild(habit);
    const date = dto.date ? parseDateKey(dto.date) : startOfToday();
    this.assertMarkable(habit, date);
    // En un medible, "hecho" es llegar a la meta (si ya iba por encima, se queda).
    const value = habit.goal > 1 ? Math.max(await this.valueOn(habit, date), habit.goal) : 1;
    return this.applyValue(userId, habit, date, value, dto.note);
  }

  async setProgress(userId: string, id: string, dateKey: string, dto: SetProgressDto) {
    if (!DATE_KEY.test(dateKey)) throw new BadRequestException('Fecha inválida');
    const habit = await this.ensureOwner(userId, id);
    this.assertBuild(habit);
    const date = parseDateKey(dateKey);
    this.assertMarkable(habit, date);
    return this.applyValue(userId, habit, date, dto.value, dto.note);
  }

  /** Un toque: suma lo que vale un toque (el boton de la notificacion usa esto en los medibles). */
  async addStep(userId: string, id: string, dateKey?: string) {
    const habit = await this.ensureOwner(userId, id);
    this.assertBuild(habit);
    const date = dateKey && DATE_KEY.test(dateKey) ? parseDateKey(dateKey) : startOfToday();
    this.assertMarkable(habit, date);
    const current = await this.valueOn(habit, date);
    return this.applyValue(userId, habit, date, current + Math.max(1, habit.step));
  }

  private async valueOn(habit: Habit, date: Date): Promise<number> {
    const where = { habitId_date: { habitId: habit.id, date } };
    const [p, c] = await Promise.all([
      this.prisma.habitProgress.findUnique({ where }),
      this.prisma.habitCompletion.findUnique({ where }),
    ]);
    if (p) return p.value;
    return c ? Math.max(1, habit.goal) : 0;
  }

  /**
   * Fija la cantidad de un dia. Llegar a la meta crea el completado (racha, logros, retos);
   * bajar de la meta lo quita. La nota viaja con el completado o, si no se llego, con el avance.
   */
  private async applyValue(userId: string, habit: Habit, date: Date, rawValue: number, note?: string) {
    const value = Math.max(0, Math.min(MAX_VALUE, Math.round(rawValue)));
    const goal = Math.max(1, habit.goal);
    const where = { habitId_date: { habitId: habit.id, date } };
    const [prevProgress, prevCompletion] = await Promise.all([
      this.prisma.habitProgress.findUnique({ where }),
      this.prisma.habitCompletion.findUnique({ where }),
    ]);
    const cleanNote = note === undefined ? undefined : note.trim() || null;
    const keptNote = cleanNote !== undefined ? cleanNote : (prevCompletion?.note ?? prevProgress?.note ?? null);
    const done = value >= goal;

    if (done) {
      await this.prisma.habitCompletion.upsert({
        where,
        create: { habitId: habit.id, userId, date, note: keptNote },
        update: { note: keptNote },
      });
      // Si ese dia estaba congelado, ya no hace falta: el congelador vuelve al saldo.
      await this.prisma.streakFreeze.deleteMany({ where: { habitId: habit.id, date } });
    } else if (prevCompletion) {
      await this.prisma.habitCompletion.delete({ where });
    }

    if (goal > 1) {
      const progressNote = done ? null : keptNote;
      if (value === 0 && !progressNote) {
        await this.prisma.habitProgress.deleteMany({ where: { habitId: habit.id, date } });
      } else {
        await this.prisma.habitProgress.upsert({
          where,
          create: { habitId: habit.id, userId, date, value, note: progressNote },
          update: { value, note: progressNote },
        });
      }
    }

    const unlocked = done && !prevCompletion ? await this.tryUnlockAchievement(userId, habit.id, date) : null;
    const detail = await this.getOne(userId, habit.id);
    return {
      habit: detail,
      value,
      done,
      ...(unlocked ? { unlockedAchievement: unlocked } : {}),
      ...(detail.challengeWon ? { challengeWon: detail.challengeWon } : {}),
    };
  }

  async uncomplete(userId: string, id: string, dateKey: string) {
    const habit = await this.ensureOwner(userId, id);
    this.assertBuild(habit);
    const date = parseDateKey(dateKey);
    if (!isCompletableDate(date)) throw new ForbiddenException('Solo puedes marcar habitos de hoy o de ayer');
    await this.prisma.habitCompletion.deleteMany({ where: { habitId: id, userId, date } });
    await this.prisma.habitProgress.deleteMany({ where: { habitId: id, userId, date } });
    return this.getOne(userId, id);
  }

  private async tryUnlockAchievement(userId: string, habitId: string, refDate: Date): Promise<AchievementPayload | null> {
    const habit = await this.findOneFull(userId, habitId);
    if (habit.kind !== HabitKind.BUILD || !habit.streakEnabled) return null;
    const pauses = await loadPauses(this.prisma, userId);
    const streak = currentStreak(toHistoryHabit(habit, pauses), toDateKey(refDate));
    if (!isStreakMilestone(streak)) return null;
    try {
      const row = await this.prisma.habitAchievement.create({
        data: { habitId, userId, milestoneDays: streak, phraseIndex: randomInt(0, PHRASE_COUNT) },
      });
      return this.achievementPayload(row, habit);
    } catch {
      return null;
    }
  }

  // ---------- Dejar algo: recaidas ----------

  private quitStartKey(habit: Habit): string {
    return habit.startDate ? toDateKey(habit.startDate) : localDateKey(habit.createdAt);
  }

  async relapse(userId: string, id: string, dto: RelapseDto) {
    const habit = await this.ensureOwner(userId, id);
    if (habit.kind !== HabitKind.QUIT) throw new BadRequestException('Las recaídas son para los hábitos de dejar algo.');
    const todayKey = this.todayKey();
    const key = dto.date ?? todayKey;
    if (key > todayKey) throw new BadRequestException('No puedes registrar una recaída en el futuro.');
    if (diffDays(key, todayKey) > RELAPSE_WINDOW_DAYS) {
      throw new BadRequestException(`Puedes registrar recaídas de los últimos ${RELAPSE_WINDOW_DAYS} días.`);
    }
    if (key < this.quitStartKey(habit)) throw new BadRequestException('Ese día es antes de tu primer día limpio.');
    const date = parseDateKey(key);
    const note = dto.note?.trim() || null;
    await this.prisma.habitRelapse.upsert({
      where: { habitId_date: { habitId: id, date } },
      create: { habitId: id, userId, date, note },
      update: { note },
    });
    return { habit: await this.getOne(userId, id) };
  }

  async removeRelapse(userId: string, id: string, dateKey: string) {
    const habit = await this.ensureOwner(userId, id);
    if (habit.kind !== HabitKind.QUIT) throw new BadRequestException('Las recaídas son para los hábitos de dejar algo.');
    if (!DATE_KEY.test(dateKey)) throw new BadRequestException('Fecha inválida');
    await this.prisma.habitRelapse.deleteMany({ where: { habitId: id, userId, date: parseDateKey(dateKey) } });
    return { habit: await this.getOne(userId, id) };
  }

  // ---------- Congeladores ----------

  /** Congeladores: uno por cada nivel subido, menos los ya gastados. */
  async freezeBalance(userId: string) {
    const [{ history }, used] = await Promise.all([
      loadHistory(this.prisma, userId),
      this.prisma.streakFreeze.count({ where: { userId } }),
    ]);
    const progress = computeProgress(history, this.todayKey());
    return {
      earned: progress.freezesEarned,
      used,
      available: Math.max(0, progress.freezesEarned - used),
      level: progress.level.level,
    };
  }

  private assertFreezeWindow(dateKey: string) {
    const todayKey = this.todayKey();
    if (!DATE_KEY.test(dateKey) || dateKey > todayKey || diffDays(dateKey, todayKey) > FREEZE_WINDOW_DAYS) {
      throw new BadRequestException(`Puedes congelar hoy o uno de los últimos ${FREEZE_WINDOW_DAYS} días.`);
    }
  }

  async freeze(userId: string, id: string, dateKey: string) {
    const habit = await this.findOneFull(userId, id);
    if (habit.kind !== HabitKind.BUILD || habit.scheduleType === ScheduleType.WEEKLY_COUNT) {
      throw new BadRequestException('El congelador es para hábitos diarios o de días fijos.');
    }
    if (!habit.streakEnabled) throw new BadRequestException('Este hábito no lleva racha: no hace falta congelarlo.');
    this.assertFreezeWindow(dateKey);
    if (habit.freezes.some((f) => toDateKey(f.date) === dateKey)) {
      return { habit: await this.getOne(userId, id), freezes: await this.freezeBalance(userId) };
    }
    const hist = toHistoryHabit(habit, await loadPauses(this.prisma, userId));
    if (hist.doneKeys.has(dateKey)) throw new BadRequestException('Ese día ya está cumplido: no hace falta congelarlo.');
    if (!isRequiredOn(hist, dateKey)) {
      throw new BadRequestException('Ese día no se pedía este hábito (no tocaba o estaba en pausa).');
    }
    const balance = await this.freezeBalance(userId);
    if (balance.available < 1) {
      throw new BadRequestException('No te quedan congeladores. Ganas uno cada vez que subes de nivel.');
    }
    await this.prisma.streakFreeze.create({ data: { habitId: id, userId, date: parseDateKey(dateKey) } });
    return {
      habit: await this.getOne(userId, id),
      freezes: { ...balance, used: balance.used + 1, available: balance.available - 1 },
    };
  }

  async unfreeze(userId: string, id: string, dateKey: string) {
    await this.ensureOwner(userId, id);
    this.assertFreezeWindow(dateKey);
    await this.prisma.streakFreeze.deleteMany({ where: { habitId: id, userId, date: parseDateKey(dateKey) } });
    return { habit: await this.getOne(userId, id), freezes: await this.freezeBalance(userId) };
  }

  // ---------- Pausas ----------

  private pauseView(p: { id: string; habitId: string | null; startDate: Date; endDate: Date; note: string | null }) {
    const todayKey = this.todayKey();
    const startDate = toDateKey(p.startDate);
    const endDate = toDateKey(p.endDate);
    return { id: p.id, habitId: p.habitId, startDate, endDate, note: p.note, active: startDate <= todayKey && todayKey <= endDate };
  }

  /** Pausas en curso y por venir. */
  async listPauses(userId: string) {
    const rows = await this.prisma.habitPause.findMany({
      where: { userId, endDate: { gte: startOfToday() } },
      orderBy: { startDate: 'asc' },
      include: { habit: { select: { title: true, icon: true, color: true } } },
    });
    return rows.map((r) => ({ ...this.pauseView(r), habit: r.habit }));
  }

  async createPause(userId: string, dto: CreatePauseDto) {
    const todayKey = this.todayKey();
    const { startDate: s, endDate: e } = dto;
    if (e < s) throw new BadRequestException('La pausa termina antes de empezar.');
    if (diffDays(s, todayKey) > PAUSE_BACK_DAYS) {
      throw new BadRequestException(`Una pausa puede empezar hasta ${PAUSE_BACK_DAYS} días atrás.`);
    }
    if (diffDays(todayKey, s) > 365) throw new BadRequestException('Esa fecha está demasiado lejos.');
    if (diffDays(s, e) + 1 > PAUSE_MAX_DAYS) throw new BadRequestException(`Una pausa dura como máximo ${PAUSE_MAX_DAYS} días.`);
    if (dto.habitId) await this.ensureOwner(userId, dto.habitId);
    const row = await this.prisma.habitPause.create({
      data: {
        userId,
        habitId: dto.habitId ?? null,
        startDate: parseDateKey(s),
        endDate: parseDateKey(e),
        note: dto.note?.trim() || null,
      },
    });
    return this.pauseView(row);
  }

  /** Terminar una pausa: si no ha empezado (o empieza hoy) se borra; si ya corre, termina ayer. */
  async endPause(userId: string, pauseId: string) {
    const p = await this.prisma.habitPause.findFirst({ where: { id: pauseId, userId } });
    if (!p) throw new NotFoundException('Pausa no encontrada');
    const todayKey = this.todayKey();
    if (toDateKey(p.startDate) >= todayKey) {
      await this.prisma.habitPause.delete({ where: { id: p.id } });
      return { ok: true, removed: true };
    }
    if (toDateKey(p.endDate) < todayKey) throw new BadRequestException('Esa pausa ya terminó.');
    await this.prisma.habitPause.update({ where: { id: p.id }, data: { endDate: parseDateKey(shiftKey(todayKey, -1)) } });
    return { ok: true, removed: false };
  }

  // ---------- Logros ----------

  /** Vitrina: logros de cada habito activo, el siguiente hito, especiales y retos cumplidos. */
  async achievementsSummary(userId: string) {
    const todayKey = this.todayKey();
    const habits = await this.findFull({ userId, archived: false });
    const pauses = await loadPauses(this.prisma, userId);
    await this.settle(userId, habits, pauses);
    const [achievements, challenges] = await Promise.all([
      this.prisma.habitAchievement.findMany({
        where: { userId, habitId: { in: habits.map((h) => h.id) } },
        orderBy: { milestoneDays: 'asc' },
      }),
      this.prisma.challengeResult.findMany({
        where: { userId },
        orderBy: { wonAt: 'desc' },
        include: { habit: { select: { id: true, title: true, color: true, icon: true, kind: true, scheduleType: true } } },
      }),
    ]);
    const history = habits.map((h) => toHistoryHabit(h, pauses));
    const days = buildDays(history, earliestKey(history, todayKey), todayKey);

    return {
      totalMilestones: getStreakMilestones().length,
      specials: computeSpecials(history, days, todayKey),
      challenges: challenges.map((c) => ({
        ...this.challengePayload(c, c.habit),
        startDate: toDateKey(c.startDate),
        endDate: toDateKey(c.endDate),
      })),
      habits: habits.map((h, i) => {
        const hist = history[i];
        const kind = this.milestoneKind(h);
        const hasStreak = h.kind === HabitKind.QUIT || h.streakEnabled;
        const current = currentStreak(hist, todayKey);
        const next = hasStreak ? getNextMilestone(current) : null;
        return {
          habit: {
            id: h.id,
            title: h.title,
            color: h.color,
            icon: h.icon,
            streakEnabled: hasStreak,
            kind: h.kind,
            streakUnit: streakUnit(h),
          },
          currentStreak: current,
          longestStreak: longestStreak(hist, todayKey),
          unlocked: achievements
            .filter((a) => a.habitId === h.id)
            .map((a) => ({
              id: a.id,
              milestoneDays: a.milestoneDays,
              phraseIndex: a.phraseIndex,
              unlockedAt: a.unlockedAt,
              label: milestoneLabelFor(a.milestoneDays, kind),
              headline: milestoneHeadline(a.milestoneDays, kind),
              kind,
            })),
          next: next ? { milestoneDays: next, remaining: next - current, label: milestoneLabelFor(next, kind) } : null,
        };
      }),
    };
  }

  async listAchievements(userId: string, habitId: string) {
    const habit = await this.ensureOwner(userId, habitId);
    const kind = this.milestoneKind(habit);
    const rows = await this.prisma.habitAchievement.findMany({
      where: { habitId, userId },
      orderBy: { milestoneDays: 'asc' },
    });
    return rows.map((a) => ({
      ...a,
      label: milestoneLabelFor(a.milestoneDays, kind),
      headline: milestoneHeadline(a.milestoneDays, kind),
      kind,
    }));
  }

  private async ensureOwner(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({ where: { id, userId } });
    if (!habit) throw new NotFoundException('Habito no encontrado');
    return habit;
  }
}
