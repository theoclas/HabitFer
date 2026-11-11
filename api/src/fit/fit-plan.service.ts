import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FitWorkoutKind, type FitProgramRun, type FitSettings, type FitWorkout } from '@prisma/client';
import { localTodayKey, toDateKey } from '../common/date.utils';
import { checkedDate } from '../nutrition/entry.shared';
import { mondayOf, shiftKey } from '../nutrition/progress/days';
import { PrismaService } from '../prisma/prisma.service';
import { sessionKey } from './data/programs';
import { counts, routineMinutes, type WorkoutItem } from './fit-math';
import {
  matchDone,
  moveProblem,
  programEnd,
  programWeekOn,
  sameRef,
  statusOf,
  weekPlanned,
  weekdayIndex,
  type ItemStatus,
  type Ref,
  type Run,
} from './fit-plan';
import type { MoveDto, PlanDayDto, StartProgramDto } from './fit.dto';
import { EXERCISE_BY_KEY, PROGRAM_BY_KEY, readyMinutes, resolveReady } from './library';

/** El día de calendario (en la hora del servidor) de un momento. */
const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function itemsOf(w: Pick<FitWorkout, 'items'>): WorkoutItem[] | null {
  return Array.isArray(w.items) ? (w.items as unknown as WorkoutItem[]) : null;
}

type OwnInfo = { name: string; minutes: number; archived: boolean };

/** Una rutina planeada, lista para mostrar: nombre, minutos, a dónde lleva y cómo va. */
export type DayItem = Ref & {
  name: string;
  minutes: number;
  /** false si la rutina se borró o ya no existe en la biblioteca. */
  exists: boolean;
  /** La página de la rutina (el entreno guiado es `${path}/entrenar`). */
  path: string;
  source: 'plan' | 'program' | 'move';
  movedFrom: string | null;
  moveId: string | null;
  week: number | null;
  doneOn: string | null;
  status: ItemStatus;
};

export const DEFAULT_SETTINGS = { goalKind: 'days' as const, weeklyGoalDays: 3, weeklyGoalMinutes: 90, remindOn: false, remindAt: '07:00' };

export function settingsView(s: FitSettings | null) {
  return {
    goalKind: (s?.goalKind === 'minutes' ? 'minutes' : 'days') as 'days' | 'minutes',
    weeklyGoalDays: s?.weeklyGoalDays ?? DEFAULT_SETTINGS.weeklyGoalDays,
    weeklyGoalMinutes: s?.weeklyGoalMinutes ?? DEFAULT_SETTINGS.weeklyGoalMinutes,
    remindOn: s?.remindOn ?? DEFAULT_SETTINGS.remindOn,
    remindAt: s?.remindAt ?? DEFAULT_SETTINGS.remindAt,
  };
}

/** FerFit, la semana: el plan de cada día, los programas de varias semanas y mover una rutina de día. */
@Injectable()
export class FitPlanService {
  constructor(private prisma: PrismaService) {}

  private async ownRoutines(userId: string): Promise<Map<string, OwnInfo>> {
    const rows = await this.prisma.fitRoutine.findMany({ where: { userId }, include: { items: true } });
    return new Map(
      rows.map((r) => [
        r.id,
        {
          name: r.name,
          archived: r.archived,
          minutes: routineMinutes(
            r.items.map((i) => ({ sets: i.sets, reps: i.reps, seconds: i.seconds, restSeconds: i.restSeconds, perSide: EXERCISE_BY_KEY.get(i.exerciseKey)?.perSide })),
            r.circuit,
            r.rounds,
          ),
        },
      ]),
    );
  }

  private describe(ref: Ref, own: Map<string, OwnInfo>) {
    if (ref.routineId) {
      const r = own.get(ref.routineId);
      return { name: r?.name ?? 'Rutina borrada', minutes: r?.minutes ?? 0, exists: !!r && !r.archived, path: `/app/ferfit/rutinas/${ref.routineId}` };
    }
    const ready = resolveReady(ref.readyKey);
    return {
      name: ready?.name ?? 'Rutina que ya no existe',
      minutes: ready ? readyMinutes(ready) : 0,
      exists: !!ready,
      path: `/app/ferfit/listas/${ref.readyKey ?? ''}`,
    };
  }

  private runsOf(rows: FitProgramRun[]): Run[] {
    return rows.map((r) => ({
      programKey: r.programKey,
      startDate: toDateKey(r.startDate),
      weekdays: r.weekdays.split(',').filter(Boolean).map(Number),
      stoppedOn: r.stoppedAt ? localKey(r.stoppedAt) : null,
    }));
  }

  /** El programa en curso (o por empezar, o recién terminado), con cuántas sesiones van. */
  private async programView(userId: string, rows: FitProgramRun[], today: string) {
    const row = rows.find((r) => !r.stoppedAt);
    const def = row ? PROGRAM_BY_KEY.get(row.programKey) : undefined;
    if (!row || !def) return null;
    const run = this.runsOf([row])[0];
    const end = programEnd(run, def);
    const status = today < run.startDate ? 'upcoming' : today > end ? 'finished' : 'active';
    const done = await this.prisma.fitWorkout.findMany({
      where: {
        userId,
        kind: FitWorkoutKind.ROUTINE,
        readyKey: { startsWith: `${def.key}--s` },
        date: { gte: checkedDate(run.startDate), lte: checkedDate(end) },
      },
      select: { date: true, readyKey: true, completed: true, items: true },
    });
    const doneKeys = new Set(
      done.filter((w) => counts({ date: toDateKey(w.date), kind: 'ROUTINE', completed: w.completed, items: itemsOf(w) })).map((w) => w.readyKey),
    );
    return {
      id: row.id,
      key: def.key,
      name: def.name,
      weeks: def.weeks,
      daysPerWeek: def.daysPerWeek,
      weekdays: run.weekdays,
      startDate: run.startDate,
      endDate: end,
      status,
      currentWeek: status === 'finished' ? def.weeks : (programWeekOn(run, def, today) ?? 0),
      done: doneKeys.size,
      total: def.weeks * def.daysPerWeek,
    };
  }

  /** La semana de esa fecha: los 7 días con lo planeado y cómo va, el plan, el programa y los ajustes. */
  async week(userId: string, dateKey?: string) {
    const today = localTodayKey();
    const monday = mondayOf(dateKey ?? today);
    const sunday = shiftKey(monday, 6);
    const [template, runRows, moveRows, workouts, own, settings] = await Promise.all([
      this.prisma.fitWeekPlan.findMany({ where: { userId } }),
      this.prisma.fitProgramRun.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.fitPlanChange.findMany({
        where: { userId, fromDate: { gte: checkedDate(monday), lte: checkedDate(sunday) } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.fitWorkout.findMany({
        where: { userId, kind: FitWorkoutKind.ROUTINE, date: { gte: checkedDate(monday), lte: checkedDate(sunday) } },
        select: { date: true, routineId: true, readyKey: true, completed: true, items: true },
      }),
      this.ownRoutines(userId),
      this.prisma.fitSettings.findUnique({ where: { userId } }),
    ]);
    const runs = this.runsOf(runRows);
    const planned = weekPlanned(monday, {
      template: template.map((t) => ({ weekday: t.weekday, routineId: t.routineId, readyKey: t.readyKey })),
      runs,
      programs: PROGRAM_BY_KEY,
      moves: moveRows.map((m) => ({ id: m.id, fromDate: toDateKey(m.fromDate), toDate: toDateKey(m.toDate), routineId: m.routineId, readyKey: m.readyKey })),
      sessionKey,
    });
    const done = workouts
      .filter((w) => counts({ date: toDateKey(w.date), kind: 'ROUTINE', completed: w.completed, items: itemsOf(w) }))
      .map((w) => ({ date: toDateKey(w.date), routineId: w.routineId, readyKey: w.readyKey }));
    const days = matchDone(planned, done).map((d) => ({
      date: d.date,
      weekday: weekdayIndex(d.date),
      items: d.items.map<DayItem>((i) => ({ ...i, ...this.describe(i, own), status: statusOf(d.date, i.doneOn, today) })),
    }));
    // Mientras un programa corre, el plan de la semana queda en pausa.
    const planPaused = days.some((d) =>
      runs.some((r) => {
        const p = PROGRAM_BY_KEY.get(r.programKey);
        return !!p && programWeekOn(r, p, d.date) !== null;
      }),
    );
    return {
      today,
      monday,
      sunday,
      days,
      template: Array.from({ length: 7 }, (_, weekday) => {
        const t = template.find((x) => x.weekday === weekday);
        return t
          ? { weekday, routineId: t.routineId, readyKey: t.readyKey, ...this.describe(t, own) }
          : { weekday, routineId: null, readyKey: null, name: null, minutes: 0, exists: true, path: null };
      }),
      planPaused,
      program: await this.programView(userId, runRows, today),
      settings: settingsView(settings),
    };
  }

  /** Lo de un día (para Hoy) y, si es hoy, lo que quedó pendiente antes en la semana. */
  async dayPlan(userId: string, date: string) {
    const w = await this.week(userId, date);
    const day = w.days.find((d) => d.date === date);
    const pending =
      date === w.today
        ? w.days.filter((d) => d.date < date).flatMap((d) => d.items.filter((i) => i.status === 'missed' && i.exists).map((i) => ({ ...i, date: d.date })))
        : [];
    return {
      items: day?.items ?? [],
      pending,
      hasPlan: w.template.some((t) => t.name !== null) || w.program !== null,
    };
  }

  /** El aviso del día (para el recordatorio), o null si hoy no toca nada pendiente. */
  async reminder(userId: string, today: string): Promise<{ title: string; body: string; path: string } | null> {
    const { items } = await this.dayPlan(userId, today);
    const pending = items.filter((i) => !i.doneOn && i.exists);
    if (!pending.length) return null;
    const first = pending[0];
    if (pending.length === 1) return { title: `Hoy te toca: ${first.name}`, body: `Unos ${first.minutes} min. Tócalo para empezar.`, path: `${first.path}/entrenar` };
    return { title: `Hoy te tocan ${pending.length} rutinas`, body: pending.map((p) => p.name).join(' · '), path: '/app/ferfit' };
  }

  private async checkRef(userId: string, ref: { routineId?: string | null; readyKey?: string | null }) {
    if (!!ref.routineId === !!ref.readyKey) throw new BadRequestException('Escoge una rutina.');
    if (ref.routineId) {
      const r = await this.prisma.fitRoutine.findFirst({ where: { id: ref.routineId, userId, archived: false }, select: { id: true } });
      if (!r) throw new NotFoundException('Esa rutina ya no existe.');
    } else if (!resolveReady(ref.readyKey)) {
      throw new NotFoundException('Esa rutina lista no existe.');
    }
  }

  /** Cambia el plan de la semana: una rutina por día; los días que no vienen quedan de descanso. */
  async setPlan(userId: string, days: PlanDayDto[]) {
    const seen = new Set<number>();
    const rows: { weekday: number; routineId: string | null; readyKey: string | null }[] = [];
    for (const d of days) {
      if (seen.has(d.weekday)) throw new BadRequestException('Cada día va una sola vez.');
      seen.add(d.weekday);
      if (!d.routineId && !d.readyKey) continue;
      await this.checkRef(userId, d);
      rows.push({ weekday: d.weekday, routineId: d.routineId ?? null, readyKey: d.routineId ? null : (d.readyKey ?? null) });
    }
    await this.prisma.$transaction([
      this.prisma.fitWeekPlan.deleteMany({ where: { userId } }),
      this.prisma.fitWeekPlan.createMany({ data: rows.map((r) => ({ userId, ...r })) }),
    ]);
    return this.week(userId);
  }

  /** Pasa una rutina planeada a otro día de la misma semana. */
  async move(userId: string, dto: MoveDto) {
    const problem = moveProblem(dto.from, dto.to, localTodayKey());
    if (problem) throw new BadRequestException(problem);
    const ref = { routineId: dto.routineId ?? null, readyKey: dto.routineId ? null : (dto.readyKey ?? null) };
    if (!ref.routineId && !ref.readyKey) throw new BadRequestException('Escoge una rutina.');
    const w = await this.week(userId, dto.from);
    const from = w.days.find((d) => d.date === dto.from);
    if (!from?.items.some((i) => sameRef(i, ref) && !i.doneOn)) throw new BadRequestException('Esa rutina no está pendiente ese día.');
    await this.prisma.fitPlanChange.create({ data: { userId, fromDate: checkedDate(dto.from), toDate: checkedDate(dto.to), ...ref } });
    return this.week(userId, dto.from);
  }

  /** Deshacer: la rutina vuelve a su día (y si después se movió otra vez, también se deshace). */
  async undoMove(userId: string, id: string) {
    const first = await this.prisma.fitPlanChange.findFirst({ where: { id, userId } });
    if (!first) throw new NotFoundException('Ese cambio ya no está.');
    const ids = [first.id];
    let current = first;
    for (let i = 0; i < 7; i++) {
      const next = await this.prisma.fitPlanChange.findFirst({
        where: { userId, fromDate: current.toDate, routineId: current.routineId, readyKey: current.readyKey, createdAt: { gte: current.createdAt }, id: { notIn: ids } },
        orderBy: { createdAt: 'asc' },
      });
      if (!next) break;
      ids.push(next.id);
      current = next;
    }
    await this.prisma.fitPlanChange.deleteMany({ where: { userId, id: { in: ids } } });
    return this.week(userId, toDateKey(first.fromDate));
  }

  /** Empieza un programa (deja el que hubiera): sus sesiones se ponen solas en esos días. */
  async startProgram(userId: string, dto: StartProgramDto) {
    const p = PROGRAM_BY_KEY.get(dto.programKey);
    if (!p) throw new NotFoundException('Ese programa no existe.');
    const weekdays = [...new Set(dto.weekdays)].sort((a, b) => a - b);
    if (weekdays.length !== p.daysPerWeek) throw new BadRequestException(`Escoge ${p.daysPerWeek} días de la semana.`);
    const today = localTodayKey();
    const start = dto.start === 'next' ? shiftKey(mondayOf(today), 7) : mondayOf(today);
    await this.prisma.$transaction([
      this.prisma.fitProgramRun.updateMany({ where: { userId, stoppedAt: null }, data: { stoppedAt: new Date() } }),
      this.prisma.fitProgramRun.create({ data: { userId, programKey: p.key, startDate: checkedDate(start), weekdays: weekdays.join(',') } }),
    ]);
    return this.week(userId);
  }

  /** Dejar el programa (o quitar uno ya terminado): desde hoy vuelve el plan de la semana. */
  async stopProgram(userId: string) {
    await this.prisma.fitProgramRun.updateMany({ where: { userId, stoppedAt: null }, data: { stoppedAt: new Date() } });
    return this.week(userId);
  }
}
