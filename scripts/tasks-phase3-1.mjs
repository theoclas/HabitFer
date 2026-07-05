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

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
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
  projects     Project[]
  tasks        Task[]
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

model Project {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String   @db.VarChar(80)
  color     String   @default("#38bdf8") @db.VarChar(7)
  sortOrder Int      @default(0)
  archived  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tasks     Task[]

  @@index([userId, archived])
}

model Task {
  id              String       @id @default(cuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectId       String?
  project         Project?     @relation(fields: [projectId], references: [id], onDelete: SetNull)
  title           String       @db.VarChar(200)
  description     String?      @db.VarChar(1000)
  status          TaskStatus   @default(TODO)
  priority        TaskPriority @default(MEDIUM)
  dueDate         DateTime?    @db.Date
  dueTime         String?      @db.VarChar(5)
  reminderEnabled Boolean      @default(false)
  reminderAt      DateTime?
  sortOrder       Int          @default(0)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([userId, status])
  @@index([userId, dueDate])
  @@index([projectId])
}
`);

console.log("schema ok");
