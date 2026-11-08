import { HabitKind, ScheduleType, TimeOfDay } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

  /** Hacer algo (BUILD) o dejar algo (QUIT). No cambia despues de creado. */
  @IsOptional()
  @IsEnum(HabitKind)
  kind?: HabitKind;

  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  scheduleDays?: number[];

  /** X veces por semana (WEEKLY_COUNT). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weeklyTarget?: number;

  @IsOptional()
  @IsEnum(TimeOfDay)
  timeOfDay?: TimeOfDay;

  @IsOptional()
  @IsBoolean()
  streakEnabled?: boolean;

  /** Meta del dia: 1 = si/no; mas de 1 = medible. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  goal?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string | null;

  /** Cuanto suma cada toque en un habito medible. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  step?: number;

  /** Dejar algo: primer dia limpio (hoy o antes). */
  @IsOptional()
  @Matches(DATE_KEY_PATTERN)
  startDate?: string;

  /** Reto de N dias (null = quitar el reto). */
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(365)
  challengeDays?: number | null;

  /** Primer dia del reto (por defecto, hoy). Mandarlo de nuevo reinicia el reto. */
  @IsOptional()
  @Matches(DATE_KEY_PATTERN)
  challengeStart?: string;

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  reminderTime?: string;

  /** Todas las horas de aviso (HH:mm); reemplaza a reminderTime cuando viene. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true })
  reminderTimes?: string[];
}
