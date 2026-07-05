import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

w("api/src/stats/stats.utils.ts", `export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const da = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + da;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return startOfDay(d);
}

export function lastNDays(n: number, ref = new Date()): Date[] {
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(addDays(ref, -i));
  }
  return days;
}

export function dayLabel(date: Date): string {
  const names = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  return names[date.getDay()];
}
`);

w("api/src/stats/stats.service.ts", `import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import {
  getCurrentStreak,
  getLongestStreak,
  isScheduledDay,
  parseScheduleDays,
  toDateKey,
} from '../habits/habits.utils';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, dayLabel, lastNDays, startOfDay, toDateKey as statsDateKey } from './stats.utils';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async overview(userId: string) {
    const today = startOfDay(new Date());
    const weekDays = lastNDays(7, today);

    const habits = await this.prisma.habit.findMany({
      where: { userId, archived: false },
      include: { completions: { select: { date: true } } },
    });

    const completions = await this.prisma.habitCompletion.findMany({
      where: { userId, date: { gte: addDays(today, -6) } },
      select: { date: true, habitId: true },
    });

    const completionByDay = weekDays.map((day) => {
      const key = statsDateKey(day);
      let scheduled = 0;
      let done = 0;
      for (const habit of habits) {
        if (!isScheduledDay(habit.scheduleType, habit.scheduleDays, day)) continue;
        scheduled++;
        const keys = new Set(habit.completions.map((c) => toDateKey(c.date)));
        if (keys.has(key)) done++;
      }
      return { date: key, label: dayLabel(day), scheduled, completed: done, rate: scheduled ? Math.round((done / scheduled) * 100) : 0 };
    });

    const topStreaks = habits
      .filter((h) => h.streakEnabled)
      .map((h) => {
        const keys = new Set(h.completions.map((c) => toDateKey(c.date)));
        return {
          id: h.id,
          title: h.title,
          color: h.color,
          currentStreak: getCurrentStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, keys, today),
          longestStreak: getLongestStreak(h.scheduleType, h.scheduleDays, h.streakEnabled, [...keys]),
        };
      })
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .slice(0, 5);

    const weekStart = addDays(today, -6);
    const tasksDoneWeek = await this.prisma.task.count({
      where: { userId, status: TaskStatus.DONE, updatedAt: { gte: weekStart } },
    });
    const tasksOpen = await this.prisma.task.count({
      where: { userId, status: { not: TaskStatus.DONE } },
    });

    const tasksByDay = await Promise.all(
      weekDays.map(async (day) => {
        const next = addDays(day, 1);
        const count = await this.prisma.task.count({
          where: { userId, status: TaskStatus.DONE, updatedAt: { gte: day, lt: next } },
        });
        return { date: statsDateKey(day), label: dayLabel(day), completed: count };
      }),
    );

    const totalScheduledWeek = completionByDay.reduce((s, d) => s + d.scheduled, 0);
    const totalCompletedWeek = completionByDay.reduce((s, d) => s + d.completed, 0);

    return {
      habits: {
        active: habits.length,
        weekCompletionRate: totalScheduledWeek ? Math.round((totalCompletedWeek / totalScheduledWeek) * 100) : 0,
        daily: completionByDay,
        topStreaks,
      },
      tasks: {
        open: tasksOpen,
        completedThisWeek: tasksDoneWeek,
        daily: tasksByDay,
      },
    };
  }

  async habitDetail(userId: string, habitId: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId },
      include: { completions: { orderBy: { date: 'asc' } } },
    });
    if (!habit) throw new NotFoundException('Habito no encontrado');

    const today = startOfDay(new Date());
    const days30 = lastNDays(30, today);
    const keys = new Set(habit.completions.map((c) => toDateKey(c.date)));

    let scheduled = 0;
    let completed = 0;
    const calendar = days30.map((day) => {
      const key = statsDateKey(day);
      const isScheduled = isScheduledDay(habit.scheduleType, habit.scheduleDays, day);
      const isDone = keys.has(key);
      if (isScheduled) {
        scheduled++;
        if (isDone) completed++;
      }
      return { date: key, scheduled: isScheduled, completed: isDone };
    });

    return {
      id: habit.id,
      title: habit.title,
      color: habit.color,
      streakEnabled: habit.streakEnabled,
      currentStreak: getCurrentStreak(habit.scheduleType, habit.scheduleDays, habit.streakEnabled, keys, today),
      longestStreak: getLongestStreak(
        habit.scheduleType,
        habit.scheduleDays,
        habit.streakEnabled,
        habit.completions.map((c) => toDateKey(c.date)),
      ),
      completionRate30d: scheduled ? Math.round((completed / scheduled) * 100) : 0,
      calendar,
    };
  }

  async tasksSummary(userId: string) {
    const [todo, inProgress, done, high, medium, low] = await Promise.all([
      this.prisma.task.count({ where: { userId, status: TaskStatus.TODO } }),
      this.prisma.task.count({ where: { userId, status: TaskStatus.IN_PROGRESS } }),
      this.prisma.task.count({ where: { userId, status: TaskStatus.DONE } }),
      this.prisma.task.count({ where: { userId, priority: 'HIGH', status: { not: TaskStatus.DONE } } }),
      this.prisma.task.count({ where: { userId, priority: 'MEDIUM', status: { not: TaskStatus.DONE } } }),
      this.prisma.task.count({ where: { userId, priority: 'LOW', status: { not: TaskStatus.DONE } } }),
    ]);

    const today = startOfDay(new Date());
    const weeks = [0, 1, 2, 3].map((w) => {
      const start = addDays(today, -(w + 1) * 7 + 1);
      const end = addDays(today, -w * 7 + 1);
      return { start, end, label: 'Sem ' + (4 - w) };
    });

    const weekly = await Promise.all(
      weeks.map(async (w) => ({
        label: w.label,
        completed: await this.prisma.task.count({
          where: { userId, status: TaskStatus.DONE, updatedAt: { gte: w.start, lt: w.end } },
        }),
      })),
    );

    return {
      byStatus: { todo, inProgress, done },
      byPriorityOpen: { high, medium, low },
      weeklyCompleted: weekly.reverse(),
    };
  }
}
`);

w("api/src/stats/stats.controller.ts", `import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private stats: StatsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUserPayload) {
    return this.stats.overview(user.userId);
  }

  @Get('habits/:id')
  habit(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.stats.habitDetail(user.userId, id);
  }

  @Get('tasks')
  tasks(@CurrentUser() user: AuthUserPayload) {
    return this.stats.tasksSummary(user.userId);
  }
}
`);

w("api/src/stats/stats.module.ts", `import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
`);

w("api/src/app.module.ts", `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { HabitsModule } from './habits/habits.module';
import { PrismaModule } from './prisma/prisma.module';
import { RemindersModule } from './reminders/reminders.module';
import { StatsModule } from './stats/stats.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    HabitsModule,
    TasksModule,
    RemindersModule,
    StatsModule,
  ],
})
export class AppModule {}
`);

console.log("stats api ok");
