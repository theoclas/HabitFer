import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateHabitDto, DATE_KEY_PATTERN } from './create-habit.dto';

/** Cantidad del dia en un habito medible (0 borra el avance). */
export class SetProgressDto {
  @IsInt()
  @Min(0)
  @Max(100000)
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class RelapseDto {
  @IsOptional()
  @Matches(DATE_KEY_PATTERN)
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreatePauseDto {
  /** Sin habitId, la pausa es de todos los habitos (vacaciones). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  habitId?: string;

  @Matches(DATE_KEY_PATTERN)
  startDate!: string;

  @Matches(DATE_KEY_PATTERN)
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}

export class ReorderHabitsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @IsString({ each: true })
  ids!: string[];
}

/** Varios habitos de una plantilla en una sola llamada. */
export class BulkCreateHabitsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CreateHabitDto)
  habits!: CreateHabitDto[];
}
