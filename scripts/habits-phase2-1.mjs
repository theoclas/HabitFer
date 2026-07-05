import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

w("api/prisma/schema.prisma", `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum ScheduleType {
  DAILY
  WEEKLY
}

model User {
  id           String            @id @default(cuid())
  email        String            @unique
  username     String            @unique @db.VarChar(64)
  passwordHash String
  fullName     String            @db.VarChar(120)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  habits       Habit[]
  completions  HabitCompletion[]
}

model Habit {
  id              String            @id @default(cuid())
  userId          String
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  title           String            @db.VarChar(120)
  description     String?           @db.VarChar(500)
  color           String            @default("#22d3ee") @db.VarChar(7)
  icon            String?           @db.VarChar(32)
  archived        Boolean           @default(false)
  scheduleType    ScheduleType      @default(DAILY)
  scheduleDays    Json              @default("[1,2,3,4,5,6,7]")
  streakEnabled   Boolean           @default(true)
  reminderEnabled Boolean           @default(false)
  reminderTime    String?           @db.VarChar(5)
  sortOrder       Int               @default(0)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  completions     HabitCompletion[]

  @@index([userId, archived])
}

model HabitCompletion {
  id        String   @id @default(cuid())
  habitId   String
  habit     Habit    @relation(fields: [habitId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date      DateTime @db.Date
  note      String?  @db.VarChar(300)
  createdAt DateTime @default(now())

  @@unique([habitId, date])
  @@index([userId, date])
}
`);

w("api/src/habits/habits.utils.ts", `import { ScheduleType } from '@prisma/client';

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function parseScheduleDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [...ISO_DAYS];
  const days = value.filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 7);
  return days.length ? days : [...ISO_DAYS];
}

export function toIsoWeekday(date: Date): number {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return startOfDay(new Date(y, m - 1, d));
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return startOfDay(d);
}

export function isScheduledDay(scheduleType: ScheduleType, scheduleDays: unknown, date: Date): boolean {
  if (scheduleType === ScheduleType.DAILY) return true;
  return parseScheduleDays(scheduleDays).includes(toIsoWeekday(date));
}

export function getCurrentStreak(
  scheduleType: ScheduleType,
  scheduleDays: unknown,
  streakEnabled: boolean,
  completionKeys: Set<string>,
  referenceDate = new Date(),
): number {
  if (!streakEnabled) return 0;

  let streak = 0;
  let cursor = startOfDay(referenceDate);

  for (let i = 0; i < 400; i++) {
    if (isScheduledDay(scheduleType, scheduleDays, cursor)) {
      const key = toDateKey(cursor);
      if (completionKeys.has(key)) {
        streak++;
      } else if (isSameDay(cursor, referenceDate)) {
        // hoy pendiente, no rompe racha aun
      } else {
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function getLongestStreak(
  scheduleType: ScheduleType,
  scheduleDays: unknown,
  streakEnabled: boolean,
  completionKeys: string[],
): number {
  if (!streakEnabled || completionKeys.length === 0) return 0;

  const sorted = [...new Set(completionKeys)].sort();
  let longest = 0;
  let current = 0;
  let prev: Date | null = null;

  for (const key of sorted) {
    const date = parseDateKey(key);
    if (!isScheduledDay(scheduleType, scheduleDays, date)) continue;

    if (!prev) {
      current = 1;
    } else {
      let expected = addDays(prev, 1);
      let chainOk = false;
      while (!isSameDay(expected, date)) {
        if (isScheduledDay(scheduleType, scheduleDays, expected)) {
          chainOk = false;
          break;
        }
        expected = addDays(expected, 1);
        if (expected > date) break;
      }
      if (isSameDay(expected, date)) chainOk = true;
      current = chainOk ? current + 1 : 1;
    }

    longest = Math.max(longest, current);
    prev = date;
  }

  return longest;
}
`);

console.log("habits utils + schema ok");
