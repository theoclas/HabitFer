import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

w("api/src/tasks/tasks.utils.ts", `export function startOfDay(date: Date): Date {
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

export function isOverdue(dueDate: Date | null, status: string, ref = new Date()): boolean {
  if (!dueDate || status === 'DONE') return false;
  return startOfDay(dueDate) < startOfDay(ref);
}

export function isDueToday(dueDate: Date | null, ref = new Date()): boolean {
  if (!dueDate) return false;
  return toDateKey(dueDate) === toDateKey(ref);
}
`);

w("api/src/tasks/dto/create-project.dto.ts", `import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;
}
`);

w("api/src/tasks/dto/update-project.dto.ts", `import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateProjectDto } from './create-project.dto';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
`);

w("api/src/tasks/dto/create-task.dto.ts", `import { TaskPriority, TaskStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  @Matches(/^\\d{4}-\\d{2}-\\d{2}$/)
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\\d|2[0-3]):[0-5]\\d$/)
  dueTime?: string | null;

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;
}
`);

w("api/src/tasks/dto/update-task.dto.ts", `import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
`);

console.log("tasks dtos ok");
