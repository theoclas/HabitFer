import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

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
      include: { completions: { select: { date: true } } },
    });

    return habits
      .filter((h) => isScheduledDay(h.scheduleType, h.scheduleDays, ref))
      .map((h) => {
        const keys = new Set(h.completions.map((c) => toDateKey(c.date)));
        const base = this.toView(h);
        return {
          ...base,
          scheduledForDate: toDateKey(ref),
          completedToday: keys.has(toDateKey(ref)),
          currentStreak: getCurrentStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, keys, ref),
        };
      });
  }

  async getOne(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id, userId },
      include: { completions: { orderBy: { date: 'desc' }, take: 90, select: { date: true } } },
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
      include: { completions: { select: { date: true } } },
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
      include: { completions: { select: { date: true } } },
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
      recentCompletions: withHistory ? [...completionKeys].sort().reverse() : undefined,
    };
  }
}
`);

w("api/src/habits/habits.controller.ts", `import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CompleteHabitDto } from './dto/complete-habit.dto';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { HabitsService } from './habits.service';

@Controller('habits')
@UseGuards(JwtAuthGuard)
export class HabitsController {
  constructor(private habits: HabitsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload, @Query('archived') archived?: string) {
    return this.habits.list(user.userId, archived === 'true');
  }

  @Get('today')
  today(@CurrentUser() user: AuthUserPayload, @Query('date') date?: string) {
    return this.habits.today(user.userId, date);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.habits.getOne(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateHabitDto) {
    return this.habits.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: UpdateHabitDto) {
    return this.habits.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.habits.remove(user.userId, id);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: CompleteHabitDto) {
    return this.habits.complete(user.userId, id, dto);
  }

  @Delete(':id/complete/:date')
  uncomplete(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Param('date') date: string) {
    return this.habits.uncomplete(user.userId, id, date);
  }
}
`);

w("api/src/habits/habits.module.ts", `import { Module } from '@nestjs/common';
import { HabitsController } from './habits.controller';
import { HabitsService } from './habits.service';

@Module({
  controllers: [HabitsController],
  providers: [HabitsService],
})
export class HabitsModule {}
`);

w("api/src/app.module.ts", `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HabitsModule } from './habits/habits.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, HabitsModule],
})
export class AppModule {}
`);

console.log("habits controller + module ok");
