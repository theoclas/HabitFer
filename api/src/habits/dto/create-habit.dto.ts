import { ScheduleType } from '@prisma/client';
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
  @IsString()
  @MaxLength(32)
  icon?: string;

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
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  reminderTime?: string;
}
