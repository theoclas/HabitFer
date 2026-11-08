import { BadRequestException, Injectable } from '@nestjs/common';
import { HabitKind, ScheduleType, TaskPriority, TaskStatus, TimeOfDay } from '@prisma/client';
import { parseDateKey, startOfToday, toDateKey } from '../common/date.utils';
import { parseScheduleDays } from '../habits/habit-rules';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeReminderTimes } from '../reminders/reminder-text.utils';
import {
  BACKUP_APP,
  BACKUP_VERSION,
  clampInt,
  cleanText,
  normTitle,
  oneOf,
  toCsv,
  validDateKey,
} from './export.utils';

const MAX_HABITS = 500;
const MAX_ROWS = 50_000;
const HEX = /^#[0-9A-Fa-f]{6}$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown, max = MAX_ROWS): unknown[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new BadRequestException('El respaldo tiene un formato inesperado.');
  if (v.length > max) throw new BadRequestException('El respaldo es demasiado grande para importarlo de una vez.');
  return v;
};

export type ImportReport = {
  habitsCreated: number;
  habitsMerged: number;
  completions: number;
  amounts: number;
  relapses: number;
  freezes: number;
  achievements: number;
  challenges: number;
  pauses: number;
  moods: number;
  projects: number;
  tasks: number;
};

/**
 * Respaldo de HabitFer: exportar todo (JSON) o el historial (CSV), e importar un respaldo
 * sumando solo lo que falta. Importar nunca borra ni cambia lo que ya existe.
 */
@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async exportJson(userId: string) {
    const [user, habits, pauses, moods, projects, tasks] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { username: true, fullName: true } }),
      this.prisma.habit.findMany({
        where: { userId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          completions: { select: { date: true, note: true }, orderBy: { date: 'asc' } },
          progress: { select: { date: true, value: true, note: true }, orderBy: { date: 'asc' } },
          relapses: { select: { date: true, note: true }, orderBy: { date: 'asc' } },
          freezes: { select: { date: true }, orderBy: { date: 'asc' } },
          achievements: { select: { milestoneDays: true, phraseIndex: true, unlockedAt: true }, orderBy: { milestoneDays: 'asc' } },
          challengeResults: { select: { days: true, startDate: true, endDate: true, phraseIndex: true, wonAt: true } },
        },
      }),
      this.prisma.habitPause.findMany({ where: { userId }, orderBy: { startDate: 'asc' } }),
      this.prisma.dayMood.findMany({ where: { userId }, orderBy: { date: 'asc' }, select: { date: true, mood: true } }),
      this.prisma.project.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);
    const key = (d: Date | null) => (d ? toDateKey(d) : null);
    return {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      user: user ? { username: user.username, fullName: user.fullName } : null,
      habits: habits.map((h) => ({
        id: h.id,
        title: h.title,
        description: h.description,
        color: h.color,
        icon: h.icon,
        archived: h.archived,
        kind: h.kind,
        scheduleType: h.scheduleType,
        scheduleDays: h.scheduleDays,
        weeklyTarget: h.weeklyTarget,
        timeOfDay: h.timeOfDay,
        streakEnabled: h.streakEnabled,
        goal: h.goal,
        unit: h.unit,
        step: h.step,
        startDate: key(h.startDate),
        challengeDays: h.challengeDays,
        challengeStart: key(h.challengeStart),
        reminderEnabled: h.reminderEnabled,
        reminderTimes: h.reminderTimes,
        sortOrder: h.sortOrder,
        createdAt: h.createdAt.toISOString(),
        completions: h.completions.map((c) => ({ date: key(c.date), note: c.note })),
        progress: h.progress.map((p) => ({ date: key(p.date), value: p.value, note: p.note })),
        relapses: h.relapses.map((r) => ({ date: key(r.date), note: r.note })),
        freezes: h.freezes.map((f) => key(f.date)),
        achievements: h.achievements.map((a) => ({ milestoneDays: a.milestoneDays, phraseIndex: a.phraseIndex, unlockedAt: a.unlockedAt.toISOString() })),
        challengeResults: h.challengeResults.map((c) => ({
          days: c.days,
          startDate: key(c.startDate),
          endDate: key(c.endDate),
          phraseIndex: c.phraseIndex,
          wonAt: c.wonAt.toISOString(),
        })),
      })),
      pauses: pauses.map((p) => ({ habitId: p.habitId, startDate: key(p.startDate), endDate: key(p.endDate), note: p.note })),
      moods: moods.map((m) => ({ date: key(m.date), mood: m.mood })),
      projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color, archived: p.archived })),
      tasks: tasks.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: key(t.dueDate),
        dueTime: t.dueTime,
        reminderEnabled: t.reminderEnabled,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  /** Historial de habitos en CSV: una fila por dia con algo (hecho, cantidad o recaida). */
  async exportCsv(userId: string): Promise<string> {
    const habits = await this.prisma.habit.findMany({
      where: { userId },
      include: {
        completions: { select: { date: true, note: true } },
        progress: { select: { date: true, value: true, note: true } },
        relapses: { select: { date: true, note: true } },
      },
    });
    const rows: { date: string; cells: (string | number | null)[] }[] = [];
    for (const h of habits) {
      const tipo = h.kind === HabitKind.QUIT ? 'dejar' : h.scheduleType === ScheduleType.WEEKLY_COUNT ? 'veces por semana' : h.goal > 1 ? 'medible' : 'sí/no';
      const amounts = new Map(h.progress.map((p) => [toDateKey(p.date), p]));
      const done = new Set<string>();
      for (const c of h.completions) {
        const k = toDateKey(c.date);
        done.add(k);
        const value = amounts.get(k)?.value ?? (h.goal > 1 ? h.goal : null);
        rows.push({ date: k, cells: [k, h.title, tipo, 'sí', value, h.goal > 1 ? h.goal : null, h.unit, c.note] });
      }
      for (const [k, p] of amounts) {
        if (done.has(k)) continue;
        rows.push({ date: k, cells: [k, h.title, tipo, 'no', p.value, h.goal, h.unit, p.note] });
      }
      for (const r of h.relapses) {
        const k = toDateKey(r.date);
        rows.push({ date: k, cells: [k, h.title, tipo, 'recaída', null, null, null, r.note] });
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || String(a.cells[1]).localeCompare(String(b.cells[1])));
    return toCsv([['fecha', 'hábito', 'tipo', 'hecho', 'cantidad', 'meta', 'unidad', 'nota'], ...rows.map((r) => r.cells)]);
  }

  async importJson(userId: string, body: unknown): Promise<ImportReport> {
    if (!isObj(body) || body.app !== BACKUP_APP || body.version !== BACKUP_VERSION) {
      throw new BadRequestException('Este archivo no es un respaldo de HabitFer.');
    }
    const todayKey = toDateKey(startOfToday());
    const report: ImportReport = {
      habitsCreated: 0,
      habitsMerged: 0,
      completions: 0,
      amounts: 0,
      relapses: 0,
      freezes: 0,
      achievements: 0,
      challenges: 0,
      pauses: 0,
      moods: 0,
      projects: 0,
      tasks: 0,
    };
    const habitsIn = list(body.habits, MAX_HABITS).filter(isObj);

    const existing = await this.prisma.habit.findMany({ where: { userId }, select: { id: true, title: true, sortOrder: true } });
    const byId = new Map(existing.map((h) => [h.id, h.id]));
    const byTitle = new Map(existing.map((h) => [normTitle(h.title), h.id]));
    let nextSort = existing.reduce((m, h) => Math.max(m, h.sortOrder), -1) + 1;
    const idMap = new Map<string, string>();

    for (const h of habitsIn) {
      const title = cleanText(h.title, 120);
      if (!title) continue;
      const fileId = typeof h.id === 'string' ? h.id : '';
      let targetId = byId.get(fileId) ?? byTitle.get(normTitle(title));
      if (targetId) {
        report.habitsMerged++;
      } else {
        const created = await this.prisma.habit.create({ data: { userId, ...this.habitFields(h, title, todayKey), sortOrder: nextSort++ } });
        targetId = created.id;
        byTitle.set(normTitle(title), targetId);
        report.habitsCreated++;
      }
      if (fileId) idMap.set(fileId, targetId);
      await this.importHistory(userId, targetId, h, todayKey, report);
    }

    // Animo por dia.
    const moods = list(body.moods)
      .filter(isObj)
      .map((m) => ({ date: validDateKey(m.date, todayKey), mood: clampInt(m.mood, 1, 5, 0) }))
      .filter((m): m is { date: string; mood: number } => Boolean(m.date) && m.mood >= 1);
    if (moods.length) {
      const res = await this.prisma.dayMood.createMany({
        data: moods.map((m) => ({ userId, date: parseDateKey(m.date), mood: m.mood })),
        skipDuplicates: true,
      });
      report.moods = res.count;
    }

    // Pausas (las de un habito que no vino en el archivo se omiten).
    const currentPauses = await this.prisma.habitPause.findMany({ where: { userId } });
    const pauseKey = (habitId: string | null, s: string, e: string) => `${habitId ?? '*'}|${s}|${e}`;
    const havePauses = new Set(currentPauses.map((p) => pauseKey(p.habitId, toDateKey(p.startDate), toDateKey(p.endDate))));
    for (const p of list(body.pauses).filter(isObj)) {
      const start = validDateKey(p.startDate, '9999-12-31');
      const end = validDateKey(p.endDate, '9999-12-31');
      if (!start || !end || end < start) continue;
      const habitId = typeof p.habitId === 'string' ? (idMap.get(p.habitId) ?? null) : null;
      if (typeof p.habitId === 'string' && !habitId) continue;
      const k = pauseKey(habitId, start, end);
      if (havePauses.has(k)) continue;
      await this.prisma.habitPause.create({
        data: { userId, habitId, startDate: parseDateKey(start), endDate: parseDateKey(end), note: cleanText(p.note, 120) },
      });
      havePauses.add(k);
      report.pauses++;
    }

    // Proyectos y tareas.
    const projects = await this.prisma.project.findMany({ where: { userId }, select: { id: true, name: true } });
    const projectById = new Set(projects.map((p) => p.id));
    const projectByName = new Map(projects.map((p) => [normTitle(p.name), p.id]));
    const projectMap = new Map<string, string>();
    for (const p of list(body.projects, 1000).filter(isObj)) {
      const name = cleanText(p.name, 80);
      const fileId = typeof p.id === 'string' ? p.id : '';
      if (!name) continue;
      let id = projectById.has(fileId) ? fileId : projectByName.get(normTitle(name));
      if (!id) {
        const created = await this.prisma.project.create({
          data: { userId, name, color: typeof p.color === 'string' && HEX.test(p.color) ? p.color : '#38bdf8', archived: p.archived === true },
        });
        id = created.id;
        projectByName.set(normTitle(name), id);
        report.projects++;
      }
      if (fileId) projectMap.set(fileId, id);
    }
    const taskIds = new Set((await this.prisma.task.findMany({ where: { userId }, select: { id: true } })).map((t) => t.id));
    for (const t of list(body.tasks, 10_000).filter(isObj)) {
      const title = cleanText(t.title, 200);
      if (!title || (typeof t.id === 'string' && taskIds.has(t.id))) continue;
      const created = typeof t.createdAt === 'string' ? new Date(t.createdAt) : null;
      await this.prisma.task.create({
        data: {
          userId,
          title,
          description: cleanText(t.description, 1000),
          projectId: typeof t.projectId === 'string' ? (projectMap.get(t.projectId) ?? null) : null,
          status: oneOf(t.status, [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE], TaskStatus.TODO),
          priority: oneOf(t.priority, [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH], TaskPriority.MEDIUM),
          dueDate: validDateKey(t.dueDate, '9999-12-31') ? parseDateKey(t.dueDate as string) : null,
          dueTime: typeof t.dueTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.dueTime) ? t.dueTime : null,
          ...(created && !Number.isNaN(created.getTime()) && created <= new Date() ? { createdAt: created } : {}),
        },
      });
      report.tasks++;
    }

    return report;
  }

  /** Campos de un habito nuevo a partir del archivo, con valores seguros. */
  private habitFields(h: Obj, title: string, todayKey: string) {
    const kind = oneOf(h.kind, [HabitKind.BUILD, HabitKind.QUIT], HabitKind.BUILD);
    const quit = kind === HabitKind.QUIT;
    const scheduleType = quit
      ? ScheduleType.DAILY
      : oneOf(h.scheduleType, [ScheduleType.DAILY, ScheduleType.WEEKLY, ScheduleType.WEEKLY_COUNT], ScheduleType.DAILY);
    const goal = quit ? 1 : clampInt(h.goal, 1, 100_000, 1);
    const createdAt = typeof h.createdAt === 'string' ? new Date(h.createdAt) : null;
    const startKey = quit ? validDateKey(h.startDate, todayKey) : null;
    const challengeDays = typeof h.challengeDays === 'number' ? clampInt(h.challengeDays, 3, 365, 30) : null;
    const challengeStart = challengeDays ? validDateKey(h.challengeStart, '9999-12-31') : null;
    const reminderTimes = quit ? [] : normalizeReminderTimes(h.reminderTimes);
    return {
      title,
      description: cleanText(h.description, 500),
      color: typeof h.color === 'string' && HEX.test(h.color) ? h.color : '#22d3ee',
      icon: cleanText(h.icon, 32),
      archived: h.archived === true,
      kind,
      scheduleType,
      scheduleDays: scheduleType === ScheduleType.WEEKLY ? parseScheduleDays(h.scheduleDays) : [1, 2, 3, 4, 5, 6, 7],
      weeklyTarget: scheduleType === ScheduleType.WEEKLY_COUNT ? clampInt(h.weeklyTarget, 1, 7, 3) : null,
      timeOfDay: oneOf(h.timeOfDay, [TimeOfDay.ANYTIME, TimeOfDay.MORNING, TimeOfDay.AFTERNOON, TimeOfDay.EVENING], TimeOfDay.ANYTIME),
      streakEnabled: quit ? true : h.streakEnabled !== false,
      goal,
      unit: goal > 1 ? cleanText(h.unit, 20) : null,
      step: goal > 1 ? clampInt(h.step, 1, goal, 1) : 1,
      startDate: startKey ? parseDateKey(startKey) : quit ? parseDateKey(todayKey) : null,
      challengeDays: challengeStart ? challengeDays : null,
      challengeStart: challengeStart ? parseDateKey(challengeStart) : null,
      reminderEnabled: !quit && h.reminderEnabled === true && reminderTimes.length > 0,
      reminderTime: reminderTimes[0] ?? null,
      reminderTimes,
      ...(createdAt && !Number.isNaN(createdAt.getTime()) && createdAt <= new Date() ? { createdAt } : {}),
    };
  }

  /** Historial de un habito: solo los dias que todavia no tiene. */
  private async importHistory(userId: string, habitId: string, h: Obj, todayKey: string, report: ImportReport) {
    const dated = <T>(rows: unknown[], fn: (r: Obj, date: Date) => T | null): T[] =>
      rows.filter(isObj).flatMap((r) => {
        const k = validDateKey(r.date, todayKey);
        if (!k) return [];
        const data = fn(r, parseDateKey(k));
        return data ? [data] : [];
      });

    const completions = dated(list(h.completions), (r, date) => ({ habitId, userId, date, note: cleanText(r.note, 300) }));
    if (completions.length) {
      report.completions += (await this.prisma.habitCompletion.createMany({ data: completions, skipDuplicates: true })).count;
    }
    const amounts = dated(list(h.progress), (r, date) => {
      const value = clampInt(r.value, 0, 100_000, -1);
      return value >= 0 ? { habitId, userId, date, value, note: cleanText(r.note, 300) } : null;
    });
    if (amounts.length) {
      report.amounts += (await this.prisma.habitProgress.createMany({ data: amounts, skipDuplicates: true })).count;
    }
    const relapses = dated(list(h.relapses), (r, date) => ({ habitId, userId, date, note: cleanText(r.note, 300) }));
    if (relapses.length) {
      report.relapses += (await this.prisma.habitRelapse.createMany({ data: relapses, skipDuplicates: true })).count;
    }
    const freezes = list(h.freezes)
      .map((k) => validDateKey(k, todayKey))
      .filter((k): k is string => Boolean(k))
      .map((k) => ({ habitId, userId, date: parseDateKey(k) }));
    if (freezes.length) {
      report.freezes += (await this.prisma.streakFreeze.createMany({ data: freezes, skipDuplicates: true })).count;
    }
    const achievements = list(h.achievements, 1000)
      .filter(isObj)
      .map((a) => ({
        habitId,
        userId,
        milestoneDays: clampInt(a.milestoneDays, 1, 100_000, 0),
        phraseIndex: clampInt(a.phraseIndex, 0, 100_000, 0),
        ...(typeof a.unlockedAt === 'string' && !Number.isNaN(new Date(a.unlockedAt).getTime()) ? { unlockedAt: new Date(a.unlockedAt) } : {}),
      }))
      .filter((a) => a.milestoneDays > 0);
    if (achievements.length) {
      report.achievements += (await this.prisma.habitAchievement.createMany({ data: achievements, skipDuplicates: true })).count;
    }
    const challenges = list(h.challengeResults, 1000)
      .filter(isObj)
      .flatMap((c) => {
        const s = validDateKey(c.startDate, todayKey);
        const e = validDateKey(c.endDate, todayKey);
        if (!s || !e) return [];
        return [
          {
            habitId,
            userId,
            days: clampInt(c.days, 3, 365, 30),
            startDate: parseDateKey(s),
            endDate: parseDateKey(e),
            phraseIndex: clampInt(c.phraseIndex, 0, 100_000, 0),
            ...(typeof c.wonAt === 'string' && !Number.isNaN(new Date(c.wonAt).getTime()) ? { wonAt: new Date(c.wonAt) } : {}),
          },
        ];
      });
    if (challenges.length) {
      report.challenges += (await this.prisma.challengeResult.createMany({ data: challenges, skipDuplicates: true })).count;
    }
  }
}
