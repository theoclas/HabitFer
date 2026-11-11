import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FitWorkoutKind, Prisma, type FitRoutine, type FitRoutineItem, type FitWorkout } from '@prisma/client';
import { localTodayKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { checkedDate } from '../nutrition/entry.shared';
import { daysBetween } from '../nutrition/progress/days';
import { counts, routineMinutes, streakOf, type WorkoutItem } from './fit-math';
import type { Activity, RoutineDto, WorkoutDto, WorkoutUpdateDto } from './fit.dto';
import { EXERCISE_BY_KEY, READY_BY_KEY } from './library';

const DEFAULT_GOAL = 3;
/** Rutinas propias como máximo (las borradas no cuentan). */
const MAX_ROUTINES = 60;

export const ACTIVITY_LABELS: Record<Activity, string> = {
  caminar: 'Caminar',
  bici: 'Bicicleta',
  futbol: 'Fútbol',
  nadar: 'Nadar',
  bailar: 'Bailar',
  otra: 'Otra actividad',
};

type RoutineRow = FitRoutine & { items: FitRoutineItem[] };

const exerciseName = (key: string) => EXERCISE_BY_KEY.get(key)?.name ?? 'Ejercicio que ya no existe';

function routineView(r: RoutineRow) {
  const items = [...r.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({ id: i.id, exerciseKey: i.exerciseKey, sets: i.sets, reps: i.reps, seconds: i.seconds, restSeconds: i.restSeconds }));
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    circuit: r.circuit,
    rounds: r.rounds,
    sourceKey: r.sourceKey,
    lastDoneAt: r.lastDoneAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
    minutes: routineMinutes(
      items.map((i) => ({ ...i, perSide: EXERCISE_BY_KEY.get(i.exerciseKey)?.perSide })),
      r.circuit,
      r.rounds,
    ),
    items,
  };
}

function itemsOf(w: FitWorkout): WorkoutItem[] | null {
  return Array.isArray(w.items) ? (w.items as unknown as WorkoutItem[]) : null;
}

function workoutView(w: FitWorkout) {
  const items = itemsOf(w);
  return {
    id: w.id,
    date: toDateKey(w.date),
    kind: w.kind,
    routineId: w.routineId,
    readyKey: w.readyKey,
    name: w.name,
    activity: w.activity,
    minutes: w.minutes,
    items,
    completed: w.completed,
    note: w.note,
    counts: counts({ date: toDateKey(w.date), kind: w.kind, completed: w.completed, items }),
  };
}

/** FerFit: rutinas propias, lo que se chuleó cada día y la racha por semanas. */
@Injectable()
export class FitService {
  constructor(private prisma: PrismaService) {}

  /* ---------- Rutinas ---------- */

  private checkItems(dto: RoutineDto) {
    for (const it of dto.items) {
      const ex = EXERCISE_BY_KEY.get(it.exerciseKey);
      if (!ex) throw new BadRequestException('Uno de los ejercicios ya no existe en la biblioteca.');
      if (it.reps == null && it.seconds == null) throw new BadRequestException(`Ponle repeticiones o segundos a «${ex.name}».`);
    }
  }

  private itemsData(dto: RoutineDto) {
    return dto.items.map((it, i) => ({
      exerciseKey: it.exerciseKey,
      sets: it.sets,
      reps: it.seconds != null ? null : (it.reps ?? null),
      seconds: it.seconds ?? null,
      restSeconds: it.restSeconds,
      sortOrder: i,
    }));
  }

  async routines(userId: string) {
    const rows = await this.prisma.fitRoutine.findMany({ where: { userId, archived: false }, include: { items: true } });
    // Las últimas hechas primero; las nunca hechas, por las más nuevas.
    rows.sort((a, b) => {
      const da = a.lastDoneAt?.getTime() ?? 0;
      const db = b.lastDoneAt?.getTime() ?? 0;
      return db - da || b.createdAt.getTime() - a.createdAt.getTime();
    });
    return rows.map(routineView);
  }

  private async findRoutine(userId: string, id: string): Promise<RoutineRow> {
    const r = await this.prisma.fitRoutine.findFirst({ where: { id, userId, archived: false }, include: { items: true } });
    if (!r) throw new NotFoundException('Esa rutina ya no existe.');
    return r;
  }

  async routine(userId: string, id: string) {
    return routineView(await this.findRoutine(userId, id));
  }

  async createRoutine(userId: string, dto: RoutineDto, sourceKey: string | null = null) {
    this.checkItems(dto);
    const count = await this.prisma.fitRoutine.count({ where: { userId, archived: false } });
    if (count >= MAX_ROUTINES) throw new BadRequestException(`Ya tienes ${MAX_ROUTINES} rutinas: borra alguna antes de crear otra.`);
    const created = await this.prisma.fitRoutine.create({
      data: {
        userId,
        name: dto.name.trim(),
        notes: dto.notes?.trim() || null,
        circuit: dto.circuit,
        rounds: dto.rounds,
        sourceKey,
        items: { create: this.itemsData(dto) },
      },
      include: { items: true },
    });
    return routineView(created);
  }

  async updateRoutine(userId: string, id: string, dto: RoutineDto) {
    this.checkItems(dto);
    await this.findRoutine(userId, id);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.fitRoutineItem.deleteMany({ where: { routineId: id } }),
      this.prisma.fitRoutine.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          notes: dto.notes?.trim() || null,
          circuit: dto.circuit,
          rounds: dto.rounds,
          items: { create: this.itemsData(dto) },
        },
        include: { items: true },
      }),
    ]);
    return routineView(updated);
  }

  /** Borrar: sale de la lista, pero lo que ya se hizo con ella se queda en el historial. */
  async removeRoutine(userId: string, id: string) {
    await this.findRoutine(userId, id);
    await this.prisma.fitRoutine.update({ where: { id }, data: { archived: true } });
    return { removed: 1 };
  }

  /** Copiar una rutina lista a «Mis rutinas» para cambiarla. */
  async copyReady(userId: string, readyKey: string) {
    const r = READY_BY_KEY.get(readyKey);
    if (!r) throw new NotFoundException('Esa rutina lista no existe.');
    return this.createRoutine(
      userId,
      {
        name: r.name,
        notes: r.summary,
        circuit: r.circuit,
        rounds: r.rounds,
        items: r.items.map((i) => ({ exerciseKey: i.key, sets: i.sets, reps: i.reps ?? null, seconds: i.seconds ?? null, restSeconds: i.rest })),
      },
      r.key,
    );
  }

  /* ---------- Lo hecho ---------- */

  /** Los ejercicios de una rutina (propia o lista) tal como están hoy, sin chulear. */
  private async snapshot(userId: string, dto: WorkoutDto) {
    if (dto.routineId) {
      const r = await this.findRoutine(userId, dto.routineId);
      const v = routineView(r);
      return {
        name: v.name,
        routineId: v.id,
        readyKey: null,
        items: v.items.map<WorkoutItem>((i) => ({
          key: i.exerciseKey,
          name: exerciseName(i.exerciseKey),
          sets: v.circuit ? v.rounds : i.sets,
          reps: i.reps,
          seconds: i.seconds,
          done: false,
        })),
      };
    }
    if (dto.readyKey) {
      const r = READY_BY_KEY.get(dto.readyKey);
      if (!r) throw new NotFoundException('Esa rutina lista no existe.');
      return {
        name: r.name,
        routineId: null,
        readyKey: r.key,
        items: r.items.map<WorkoutItem>((i) => ({
          key: i.key,
          name: exerciseName(i.key),
          sets: r.circuit ? r.rounds : i.sets,
          reps: i.reps ?? null,
          seconds: i.seconds ?? null,
          done: false,
        })),
      };
    }
    throw new BadRequestException('Di qué rutina hiciste.');
  }

  private withDone(items: WorkoutItem[], done: number[] | undefined, completed: boolean | undefined): WorkoutItem[] {
    if (completed) return items.map((i) => ({ ...i, done: true }));
    if (completed === false && !done) return items.map((i) => ({ ...i, done: false }));
    if (!done) return items;
    const set = new Set(done);
    return items.map((it, i) => ({ ...it, done: set.has(i) }));
  }

  private checkDay(dateKey: string) {
    const date = checkedDate(dateKey);
    if (dateKey > localTodayKey()) throw new BadRequestException('Ese día aún no llega.');
    return date;
  }

  /**
   * Chulear: una actividad suelta, o una rutina completa o ejercicio por ejercicio. Una rutina se anota una vez
   * por día: si ya estaba, se actualiza lo chuleado.
   */
  async saveWorkout(userId: string, dto: WorkoutDto) {
    const date = this.checkDay(dto.date);
    if (dto.kind === 'ACTIVITY') {
      const activity = dto.activity ?? 'otra';
      if (!dto.minutes) throw new BadRequestException('Di cuántos minutos fueron.');
      const name = (activity === 'otra' ? dto.name?.trim() : '') || ACTIVITY_LABELS[activity];
      const created = await this.prisma.fitWorkout.create({
        data: { userId, date, kind: FitWorkoutKind.ACTIVITY, name, activity, minutes: dto.minutes, completed: true, note: dto.note?.trim() || null },
      });
      return workoutView(created);
    }

    const snap = await this.snapshot(userId, dto);
    const existing = await this.prisma.fitWorkout.findFirst({
      where: { userId, date, kind: FitWorkoutKind.ROUTINE, routineId: snap.routineId, readyKey: snap.readyKey },
    });
    // Si ya estaba, se conserva lo que se chuleó antes (si la rutina no cambió de tamaño).
    const base = existing && itemsOf(existing)?.length === snap.items.length ? itemsOf(existing)! : snap.items;
    const items = this.withDone(base, dto.done, dto.completed);
    const completed = items.length > 0 && items.every((i) => i.done);
    const data = {
      name: snap.name,
      items: items as unknown as Prisma.InputJsonValue,
      completed,
      minutes: dto.minutes ?? existing?.minutes ?? null,
      note: dto.note?.trim() || existing?.note || null,
    };
    const saved = existing
      ? await this.prisma.fitWorkout.update({ where: { id: existing.id }, data })
      : await this.prisma.fitWorkout.create({
          data: { userId, date, kind: FitWorkoutKind.ROUTINE, routineId: snap.routineId, readyKey: snap.readyKey, ...data },
        });
    if (snap.routineId && items.some((i) => i.done)) {
      await this.prisma.fitRoutine.update({ where: { id: snap.routineId }, data: { lastDoneAt: new Date() } });
    }
    return workoutView(saved);
  }

  async updateWorkout(userId: string, id: string, dto: WorkoutUpdateDto) {
    const w = await this.prisma.fitWorkout.findFirst({ where: { id, userId } });
    if (!w) throw new NotFoundException('Eso ya no está.');
    const current = itemsOf(w);
    const items = current ? this.withDone(current, dto.done, dto.completed) : null;
    const completed = w.kind === FitWorkoutKind.ACTIVITY ? true : !!items && items.length > 0 && items.every((i) => i.done);
    const saved = await this.prisma.fitWorkout.update({
      where: { id },
      data: {
        ...(items ? { items: items as unknown as Prisma.InputJsonValue } : {}),
        completed,
        ...(dto.minutes !== undefined ? { minutes: dto.minutes } : {}),
        ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
      },
    });
    return workoutView(saved);
  }

  async removeWorkout(userId: string, id: string) {
    const { count } = await this.prisma.fitWorkout.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException('Eso ya no está.');
    return { removed: count };
  }

  async workouts(userId: string, from: string, to: string) {
    if (from > to) throw new BadRequestException('La fecha inicial va antes de la final.');
    if (daysBetween(from, to) > 400) throw new BadRequestException('Pide máximo 400 días.');
    const rows = await this.prisma.fitWorkout.findMany({
      where: { userId, date: { gte: checkedDate(from), lte: checkedDate(to) } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(workoutView);
  }

  /* ---------- Hoy y la racha ---------- */

  async home(userId: string, dateKey?: string) {
    const today = localTodayKey();
    const day = dateKey && dateKey <= today ? dateKey : today;
    const [settings, history, dayRows, routines] = await Promise.all([
      this.prisma.fitSettings.findUnique({ where: { userId } }),
      this.prisma.fitWorkout.findMany({ where: { userId }, select: { date: true, kind: true, completed: true, items: true } }),
      this.prisma.fitWorkout.findMany({ where: { userId, date: checkedDate(day) }, orderBy: { createdAt: 'asc' } }),
      this.routines(userId),
    ]);
    const goal = settings?.weeklyGoalDays ?? DEFAULT_GOAL;
    const trained = history
      .filter((w) => counts({ date: toDateKey(w.date), kind: w.kind, completed: w.completed, items: Array.isArray(w.items) ? (w.items as unknown as WorkoutItem[]) : null }))
      .map((w) => toDateKey(w.date));
    return {
      today,
      date: day,
      streak: streakOf(trained, goal, today),
      workouts: dayRows.map(workoutView),
      routines,
      activities: Object.entries(ACTIVITY_LABELS).map(([key, label]) => ({ key, label })),
    };
  }

  async setSettings(userId: string, weeklyGoalDays: number) {
    await this.prisma.fitSettings.upsert({ where: { userId }, create: { userId, weeklyGoalDays }, update: { weeklyGoalDays } });
    return { weeklyGoalDays };
  }
}
