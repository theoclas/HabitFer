import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CollabTaskKind, TaskPriority, TaskStatus } from '@prisma/client';

export class CreateCollabTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(CollabTaskKind)
  kind?: CollabTaskKind;

  @IsOptional()
  @IsString()
  activeFrom?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  dueTime?: string;
}

export class UpdateCollabTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(CollabTaskKind)
  kind?: CollabTaskKind;

  @IsOptional()
  @IsString()
  activeFrom?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  dueTime?: string | null;
}
