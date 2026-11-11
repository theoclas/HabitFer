import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DATE_KEY } from '../nutrition/nutrition.dto';

const DATE_MSG = { message: 'La fecha debe venir como AAAA-MM-DD.' };

export const ACTIVITIES = ['caminar', 'bici', 'futbol', 'nadar', 'bailar', 'otra'] as const;
export type Activity = (typeof ACTIVITIES)[number];

export class RoutineItemDto {
  @IsString()
  @MaxLength(60)
  exerciseKey!: string;

  @IsInt({ message: 'Las series son un número entero.' })
  @Min(1, { message: 'Al menos una serie.' })
  @Max(10, { message: 'Máximo 10 series.' })
  sets!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200, { message: 'Son demasiadas repeticiones.' })
  reps?: number | null;

  @IsOptional()
  @IsInt()
  @Min(5, { message: 'Mínimo 5 segundos.' })
  @Max(900, { message: 'Máximo 15 minutos por serie.' })
  seconds?: number | null;

  @IsInt()
  @Min(0)
  @Max(600, { message: 'El descanso va hasta 10 minutos.' })
  restSeconds!: number;
}

export class RoutineDto {
  @IsString()
  @MinLength(1, { message: 'Ponle un nombre a la rutina.' })
  @MaxLength(80, { message: 'El nombre es demasiado largo.' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La nota es demasiado larga.' })
  notes?: string | null;

  @IsBoolean()
  circuit!: boolean;

  @IsInt()
  @Min(1)
  @Max(10, { message: 'Máximo 10 vueltas.' })
  rounds!: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un ejercicio.' })
  @ArrayMaxSize(30, { message: 'Son demasiados ejercicios para una rutina.' })
  @ValidateNested({ each: true })
  @Type(() => RoutineItemDto)
  items!: RoutineItemDto[];
}

export class CopyRoutineDto {
  @IsString()
  @MaxLength(60)
  readyKey!: string;
}

/** Una serie hecha de verdad (modo guiado). */
export class SetLogDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500, { message: 'Son demasiadas repeticiones.' })
  reps?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600, { message: 'Una serie va hasta una hora.' })
  seconds?: number | null;

  /** Kilos (de a medio kilo). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El peso es un número.' })
  @Min(0)
  @Max(500, { message: 'Revisa el peso.' })
  weight?: number | null;
}

/** Las series reales de un ejercicio, por su posición en la rutina. */
export class ItemLogDto {
  @IsInt()
  @Min(0)
  @Max(29)
  index!: number;

  @IsArray()
  @ArrayMaxSize(20, { message: 'Son demasiadas series.' })
  @ValidateNested({ each: true })
  @Type(() => SetLogDto)
  sets!: SetLogDto[];
}

export class WorkoutDto {
  @Matches(DATE_KEY, DATE_MSG)
  date!: string;

  @IsIn(['ROUTINE', 'ACTIVITY'])
  kind!: 'ROUTINE' | 'ACTIVITY';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  routineId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  readyKey?: string;

  @IsOptional()
  @IsIn(ACTIVITIES, { message: 'Esa actividad no está en la lista.' })
  activity?: Activity;

  /** Nombre de la actividad cuando es «otra». */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Al menos un minuto.' })
  @Max(600, { message: 'Máximo 10 horas.' })
  minutes?: number;

  /** Los ejercicios hechos, por su posición en la rutina. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(29, { each: true })
  done?: number[];

  /** Hecha completa (marca todos los ejercicios). */
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  /** Ejercicios hechos que se suman a lo ya chuleado ese día (modo guiado). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(29, { each: true })
  addDone?: number[];

  /** Las series reales de cada ejercicio (modo guiado). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ItemLogDto)
  logs?: ItemLogDto[];

  /** Qué tan duro se sintió, de 1 a 10. */
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'El esfuerzo va de 1 a 10.' })
  @Max(10, { message: 'El esfuerzo va de 1 a 10.' })
  effort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class WorkoutUpdateDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(29, { each: true })
  done?: number[];

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  minutes?: number;

  /** Qué tan duro se sintió, de 1 a 10. */
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'El esfuerzo va de 1 a 10.' })
  @Max(10, { message: 'El esfuerzo va de 1 a 10.' })
  effort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

/** Claves de ejercicios separadas por coma (hasta 40). */
export class HistoryQueryDto {
  @Matches(/^[a-z0-9-]{1,60}(,[a-z0-9-]{1,60}){0,39}$/, { message: 'Pide las claves de los ejercicios separadas por coma.' })
  keys!: string;
}

export class SettingsDto {
  @IsInt({ message: 'La meta son días enteros.' })
  @Min(1, { message: 'La meta va de 1 a 7 días.' })
  @Max(7, { message: 'La meta va de 1 a 7 días.' })
  weeklyGoalDays!: number;
}

export class HomeQueryDto {
  @IsOptional()
  @Matches(DATE_KEY, DATE_MSG)
  date?: string;
}

export class RangeQueryDto {
  @Matches(DATE_KEY, DATE_MSG)
  from!: string;

  @Matches(DATE_KEY, DATE_MSG)
  to!: string;
}
