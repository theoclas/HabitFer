import { MealSlot, Sex, WeightGoal } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const DATE_KEY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DATE_MSG = { message: 'La fecha debe venir como AAAA-MM-DD.' };

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsEnum(MealSlot)
  meal?: MealSlot;
}

export class DayQueryDto {
  @Matches(DATE_KEY, DATE_MSG)
  date!: string;
}

export class EntryPartDto {
  @IsString()
  @MaxLength(40)
  partId!: string;

  @IsBoolean()
  included!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3000)
  grams?: number;
}

export class CreateEntryDto {
  @Matches(DATE_KEY, DATE_MSG)
  date!: string;

  @IsEnum(MealSlot, { message: 'Comida no válida.' })
  meal!: MealSlot;

  @IsString()
  @MaxLength(40)
  foodId!: string;

  /** Medida casera; sin ella (y sin gramos) se usa la medida por defecto del alimento. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  portionId?: string;

  /** Medida por su nombre (para repetir una anotación de los recientes). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  portionLabel?: string;

  /** Gramos exactos (en vez de una medida). */
  @IsOptional()
  @IsNumber()
  @Min(0.1, { message: 'Los gramos deben ser mayores que cero.' })
  @Max(5000, { message: 'Son demasiados gramos para una sola anotación.' })
  grams?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.05, { message: 'La cantidad debe ser mayor que cero.' })
  @Max(50, { message: 'La cantidad es demasiado grande.' })
  quantity?: number;

  /** Plato por partes: qué partes se comieron. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => EntryPartDto)
  parts?: EntryPartDto[];
}

export class UpdateEntryDto {
  @IsOptional()
  @Matches(DATE_KEY, DATE_MSG)
  date?: string;

  @IsOptional()
  @IsEnum(MealSlot, { message: 'Comida no válida.' })
  meal?: MealSlot;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  portionId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1, { message: 'Los gramos deben ser mayores que cero.' })
  @Max(5000, { message: 'Son demasiados gramos para una sola anotación.' })
  grams?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.05, { message: 'La cantidad debe ser mayor que cero.' })
  @Max(50, { message: 'La cantidad es demasiado grande.' })
  quantity?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => EntryPartDto)
  parts?: EntryPartDto[];
}

/** Alimento propio: valores por la porción que diga el usuario (o por 100 g si no la da). */
export class CreateFoodDto {
  @IsString()
  @MinLength(2, { message: 'Escribe el nombre del alimento.' })
  @MaxLength(120, { message: 'El nombre es demasiado largo.' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  portionLabel?: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'La porción debe pesar al menos 1 g.' })
  @Max(5000)
  portionGrams?: number;

  @IsNumber()
  @Min(0)
  @Max(5000, { message: 'Revisa las calorías: son demasiadas.' })
  kcal!: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  protein!: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  fat!: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  carbs!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  fiber?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  sugar?: number;

  /** mg. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50000)
  sodium?: number;
}

export class ProfileDto {
  @IsEnum(Sex, { message: 'Elige el sexo para la fórmula.' })
  sex!: Sex;

  @IsInt({ message: 'El año de nacimiento debe ser un número.' })
  @Min(1920, { message: 'Revisa el año de nacimiento.' })
  @Max(2014, { message: 'Revisa el año de nacimiento.' })
  birthYear!: number;

  @IsNumber()
  @Min(120, { message: 'La estatura va en centímetros (entre 120 y 230).' })
  @Max(230, { message: 'La estatura va en centímetros (entre 120 y 230).' })
  heightCm!: number;

  @IsNumber()
  @Min(30, { message: 'El peso va en kilos (entre 30 y 300).' })
  @Max(300, { message: 'El peso va en kilos (entre 30 y 300).' })
  weightKg!: number;

  @IsNumber()
  @Min(1.1)
  @Max(2.2)
  activity!: number;

  @IsEnum(WeightGoal)
  goal!: WeightGoal;

  @IsNumber()
  @Min(0)
  @Max(1, { message: 'El ritmo máximo es 1 kg por semana.' })
  ratePerWeek!: number;

  @IsOptional()
  @IsBoolean()
  manual?: boolean;

  @IsOptional()
  @IsInt()
  @Min(800, { message: 'La meta de calorías debe estar entre 800 y 6.000.' })
  @Max(6000, { message: 'La meta de calorías debe estar entre 800 y 6.000.' })
  kcalTarget?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(400)
  proteinTarget?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  fatTarget?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(900)
  carbsTarget?: number;

  @IsOptional()
  @IsObject()
  mealNames?: Record<string, string>;
}
