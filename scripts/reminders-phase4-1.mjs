import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

const schema = fs.readFileSync(path.join(root, "api/prisma/schema.prisma"), "utf8");
const newSchema = schema.replace(
  "  tasks        Task[]\n}",
  `  tasks        Task[]
  reminders    ReminderLog[]
}

enum ReminderSourceType {
  HABIT
  TASK
}

model ReminderLog {
  id         String             @id @default(cuid())
  userId     String
  user       User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  sourceType ReminderSourceType
  sourceId   String             @db.VarChar(64)
  title      String             @db.VarChar(200)
  body       String?            @db.VarChar(500)
  triggerAt  DateTime
  readAt     DateTime?
  createdAt  DateTime           @default(now())

  @@index([userId, readAt])
  @@index([sourceType, sourceId, triggerAt])
}`
);
w("api/prisma/schema.prisma", newSchema);

w("api/src/reminders/reminders.utils.ts", `export function startOfMinute(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

export function endOfMinute(date: Date): Date {
  const d = startOfMinute(date);
  d.setMinutes(d.getMinutes() + 1);
  return d;
}

export function formatHHmm(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return h + ':' + m;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const da = String(date.getDate()).padStart(2, '0');
  return y + '-' + mo + '-' + da;
}
`);

w("api/src/reminders/reminders.service.ts", `import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderSourceType, TaskStatus } from '@prisma/client';
import { isScheduledDay, toDateKey as habitDateKey, startOfDay as habitStartOfDay } from '../habits/habits.utils';
import { PrismaService } from '../prisma/prisma.service';
import { endOfMinute, formatHHmm, startOfDay, startOfMinute } from './reminders.utils';

@Injectable()
export class RemindersService {
  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    await this.dispatchDueReminders(new Date());
  }

  async syncAndList(userId: string) {
    await this.dispatchDueReminders(new Date(), userId);
    return this.listPending(userId);
  }

  async countUnread(userId: string) {
    await this.dispatchDueReminders(new Date(), userId);
    return { count: await this.prisma.reminderLog.count({ where: { userId, readAt: null } }) };
  }

  async listPending(userId: string) {
    const rows = await this.prisma.reminderLog.findMany({
      where: { userId, readAt: null },
      orderBy: { triggerAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      title: r.title,
      body: r.body,
      triggerAt: r.triggerAt,
      createdAt: r.createdAt,
    }));
  }

  async markRead(userId: string, id: string) {
    const row = await this.prisma.reminderLog.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Recordatorio no encontrado');
    await this.prisma.reminderLog.update({ where: { id }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.reminderLog.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  private async dispatchDueReminders(now: Date, userId?: string) {
    const hhmm = formatHHmm(now);
    const today = startOfDay(now);
    const minuteStart = startOfMinute(now);
    const minuteEnd = endOfMinute(now);

    const habits = await this.prisma.habit.findMany({
      where: {
        reminderEnabled: true,
        reminderTime: hhmm,
        archived: false,
        ...(userId ? { userId } : {}),
      },
      include: { completions: { where: { date: today } } },
    });

    for (const habit of habits) {
      if (!isScheduledDay(habit.scheduleType, habit.scheduleDays, now)) continue;
      if (habit.completions.length > 0) continue;
      await this.createIfNew({
        userId: habit.userId,
        sourceType: ReminderSourceType.HABIT,
        sourceId: habit.id,
        title: habit.title,
        body: 'Es hora de completar tu habito',
        triggerAt: minuteStart,
      });
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        reminderEnabled: true,
        status: { not: TaskStatus.DONE },
        reminderAt: { gte: minuteStart, lt: minuteEnd },
        ...(userId ? { userId } : {}),
      },
    });

    for (const task of tasks) {
      await this.createIfNew({
        userId: task.userId,
        sourceType: ReminderSourceType.TASK,
        sourceId: task.id,
        title: task.title,
        body: 'Recordatorio de tarea',
        triggerAt: minuteStart,
      });
    }
  }

  private async createIfNew(input: {
    userId: string;
    sourceType: ReminderSourceType;
    sourceId: string;
    title: string;
    body: string;
    triggerAt: Date;
  }) {
    const minuteEnd = endOfMinute(input.triggerAt);
    const existing = await this.prisma.reminderLog.findFirst({
      where: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        triggerAt: { gte: input.triggerAt, lt: minuteEnd },
      },
    });
    if (existing) return;

    await this.prisma.reminderLog.create({
      data: {
        userId: input.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        title: input.title,
        body: input.body,
        triggerAt: input.triggerAt,
      },
    });
  }
}
`);

w("api/src/reminders/reminders.controller.ts", `import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { RemindersService } from './reminders.service';

@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private reminders: RemindersService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload) {
    return this.reminders.syncAndList(user.userId);
  }

  @Get('count')
  count(@CurrentUser() user: AuthUserPayload) {
    return this.reminders.countUnread(user.userId);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.reminders.markRead(user.userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUserPayload) {
    return this.reminders.markAllRead(user.userId);
  }
}
`);

w("api/src/reminders/reminders.module.ts", `import { Module } from '@nestjs/common';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
`);

w("api/src/app.module.ts", `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { HabitsModule } from './habits/habits.module';
import { PrismaModule } from './prisma/prisma.module';
import { RemindersModule } from './reminders/reminders.module';
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
  ],
})
export class AppModule {}
`);

console.log("reminders backend ok");
