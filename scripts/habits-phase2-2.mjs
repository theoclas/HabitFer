import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

w("api/src/habits/dto/create-habit.dto.ts", `import { ScheduleType } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength, ArrayMinSize } from 'class-validator';

export class CreateHabitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;

  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  scheduleDays?: number[];

  @IsOptional()
  @IsBoolean()
  streakEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\\d|2[0-3]):[0-5]\\d$/)
  reminderTime?: string;
}
`);

w("api/src/habits/dto/update-habit.dto.ts", `import { PartialType } from '@nestjs/mapped-types';
import { CreateHabitDto } from './create-habit.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateHabitDto extends PartialType(CreateHabitDto) {
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
`);

w("api/src/habits/dto/complete-habit.dto.ts", `import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CompleteHabitDto {
  @IsOptional()
  @IsString()
  @Matches(/^\\d{4}-\\d{2}-\\d{2}$/)
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
`);

w("api/src/habits/habits.service.ts", `import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Habit, ScheduleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteHabitDto } from './dto/complete-habit.dto';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import {
  getCurrentStreak,
  getLongestStreak,
  isScheduledDay,
  parseDateKey,
  parseScheduleDays,
  startOfDay,
  toDateKey,
} from './habits.utils';

export type HabitView = ReturnType<HabitsService['toView']>;

@Injectable()
export class HabitsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, includeArchived = false) {
    const habits = await this.prisma.habit.findMany({
      where: { userId, archived: includeArchived ? undefined : false },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { completions: { select: { date: true } } },
    });
    return habits.map((h) => this.toView(h));
  }

  async today(userId: string, dateKey?: string) {
    const ref = dateKey ? parseDateKey(dateKey) : startOfDay(new Date());
    const habits = await this.prisma.habit.findMany({
      where: { userId, archived: false },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { completions: { where: { date: ref } } },
    });

    return habits
      .filter((h) => isScheduledDay(h.scheduleType, h.scheduleDays, ref))
      .map((h) => {
        const allCompletions = this.prisma.habitCompletion.findMany({ where: { habitId: h.id } });
        return allCompletions.then(async (comps) => {
          const keys = new Set(comps.map((c) => toDateKey(c.date)));
          const base = this.toView({ ...h, completions: comps });
          return {
            ...base,
            scheduledForDate: toDateKey(ref),
            completedToday: h.completions.length > 0,
            currentStreak: getCurrentStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, keys, ref),
          };
        });
      });
  }

  async getOne(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id, userId },
      include: { completions: { orderBy: { date: 'desc' }, take: 90 } },
    });
    if (!habit) throw new NotFoundException('Habito no encontrado');
    return this.toView(habit, true);
  }

  async create(userId: string, dto: CreateHabitDto) {
    const habit = await this.prisma.habit.create({
      data: {
        userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        color: dto.color ?? '#22d3ee',
        scheduleType: dto.scheduleType ?? ScheduleType.DAILY,
        scheduleDays: dto.scheduleDays ?? [1, 2, 3, 4, 5, 6, 7],
        streakEnabled: dto.streakEnabled ?? true,
        reminderEnabled: dto.reminderEnabled ?? false,
        reminderTime: dto.reminderEnabled ? dto.reminderTime ?? null : null,
      },
      include: { completions: true },
    });
    return this.toView(habit);
  }

  async update(userId: string, id: string, dto: UpdateHabitDto) {
    await this.ensureOwner(userId, id);
    const habit = await this.prisma.habit.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        color: dto.color,
        scheduleType: dto.scheduleType,
        scheduleDays: dto.scheduleDays,
        streakEnabled: dto.streakEnabled,
        reminderEnabled: dto.reminderEnabled,
        reminderTime: dto.reminderEnabled === false ? null : dto.reminderTime,
        archived: dto.archived,
      },
      include: { completions: true },
    });
    return this.toView(habit);
  }

  async remove(userId: string, id: string) {
    await this.ensureOwner(userId, id);
    await this.prisma.habit.delete({ where: { id } });
    return { ok: true };
  }

  async complete(userId: string, id: string, dto: CompleteHabitDto) {
    const habit = await this.ensureOwner(userId, id);
    const date = dto.date ? parseDateKey(dto.date) : startOfDay(new Date());

    if (!isScheduledDay(habit.scheduleType, habit.scheduleDays, date)) {
      throw new ForbiddenException('Este habito no esta programado para esa fecha');
    }

    await this.prisma.habitCompletion.upsert({
      where: { habitId_date: { habitId: id, date } },
      create: { habitId: id, userId, date, note: dto.note?.trim() || null },
      update: { note: dto.note?.trim() || null },
    });

    return this.getOne(userId, id);
  }

  async uncomplete(userId: string, id: string, dateKey: string) {
    await this.ensureOwner(userId, id);
    const date = parseDateKey(dateKey);
    await this.prisma.habitCompletion.deleteMany({ where: { habitId: id, userId, date } });
    return this.getOne(userId, id);
  }

  private async ensureOwner(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({ where: { id, userId } });
    if (!habit) throw new NotFoundException('Habito no encontrado');
    return habit;
  }

  private toView(habit: Habit & { completions: { date: Date }[] }, withHistory = false) {
    const completionKeys = habit.completions.map((c) => toDateKey(c.date));
    const keysSet = new Set(completionKeys);
    const today = startOfDay(new Date());

    return {
      id: habit.id,
      title: habit.title,
      description: habit.description,
      color: habit.color,
      icon: habit.icon,
      archived: habit.archived,
      scheduleType: habit.scheduleType,
      scheduleDays: parseScheduleDays(habit.scheduleDays),
      streakEnabled: habit.streakEnabled,
      reminderEnabled: habit.reminderEnabled,
      reminderTime: habit.reminderTime,
      sortOrder: habit.sortOrder,
      createdAt: habit.createdAt,
      updatedAt: habit.updatedAt,
      currentStreak: getCurrentStreak(habit.scheduleType, habit.scheduleDays, habit.streakEnabled, keysSet, today),
      longestStreak: getLongestStreak(habit.scheduleType, habit.scheduleDays, habit.streakEnabled, completionKeys),
      completedToday: keysSet.has(toDateKey(today)),
      scheduledToday: isScheduledDay(habit.scheduleType, habit.scheduleDays, today),
      recentCompletions: withHistory ? completionKeys.slice(0, 90) : undefined,
    };
  }
}
`);

console.log("habits dtos + service ok");
