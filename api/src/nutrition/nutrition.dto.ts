import { CookMethod, MealSlot, Sex, WeightGoal } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
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

  /** Cómo se preparó; con aceite se suman sus calorías. */
  @IsOptional()
  @IsEnum(CookMethod, { message: 'Preparación no válida.' })
  prep?: CookMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300, { message: 'Es demasiado aceite para una sola anotación.' })
  oilGrams?: number;
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

  /** null quita la preparación (y su aceite). */
  @IsOptional()
  @IsEnum(CookMethod, { message: 'Preparación no válida.' })
  prep?: CookMethod | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300, { message: 'Es demasiado aceite para una sola anotación.' })
  oilGrams?: number | null;

  /** Solo en un registro rápido: nombre, calorías y macros. */
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'El nombre es demasiado largo.' })
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000, { message: 'Revisa las calorías: son demasiadas.' })
  kcal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  protein?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  fat?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  carbs?: number;
}

/** Registro rápido: solo un número de calorías (y si se quiere, los macros). */
export class QuickEntryDto {
  @Matches(DATE_KEY, DATE_MSG)
  date!: string;

  @IsEnum(MealSlot, { message: 'Comida no válida.' })
  meal!: MealSlot;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'El nombre es demasiado largo.' })
  name?: string;

  @IsNumber({}, { message: 'Escribe las calorías.' })
  @Min(1, { message: 'Escribe las calorías.' })
  @Max(10000, { message: 'Revisa las calorías: son demasiadas.' })
  kcal!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  protein?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  fat?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  carbs?: number;
}

/** Volver a anotar algo (una anotación vieja) en otro día o comida. */
export class RepeatEntryDto {
  @Matches(DATE_KEY, DATE_MSG)
  date!: string;

  @IsEnum(MealSlot, { message: 'Comida no válida.' })
  meal!: MealSlot;
}

/** Borrar varias anotaciones de una vez (deshacer, vaciar una comida). */
export class RemoveEntriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  ids!: string[];
}

/** Copiar una comida (o el día entero si no se dice cuál) a otro día. */
export class CopyDto {
  @Matches(DATE_KEY, DATE_MSG)
  fromDate!: string;

  @IsOptional()
  @IsEnum(MealSlot, { message: 'Comida no válida.' })
  fromMeal?: MealSlot;

  @Matches(DATE_KEY, DATE_MSG)
  toDate!: string;

  /** Comida de destino (por defecto la misma). */
  @IsOptional()
  @IsEnum(MealSlot, { message: 'Comida no válida.' })
  toMeal?: MealSlot;
}

/** «Escribe o dicta»: el texto como se dijo («desayuné dos arepas y un tinto»). */
export class UnderstandDto {
  @IsString()
  @MinLength(1, { message: 'Escribe lo que comiste.' })
  @MaxLength(600, { message: 'Es mucho texto de una vez: divídelo en partes.' })
  text!: string;
}

/** Un alimento confirmado de «escribe o dicta». */
export class BatchItemDto {
  @IsEnum(MealSlot, { message: 'Comida no válida.' })
  meal!: MealSlot;

  @IsString()
  @MaxLength(40)
  foodId!: string;

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
  @IsEnum(CookMethod, { message: 'Preparación no válida.' })
  prep?: CookMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  oilGrams?: number;
}

/** Nombre aprendido: «esta frase era este alimento». */
export class AliasDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  phrase!: string;

  @IsString()
  @MaxLength(40)
  foodId!: string;
}

export class BatchEntriesDto {
  @Matches(DATE_KEY, DATE_MSG)
  date!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos una cosa.' })
  @ArrayMaxSize(40, { message: 'Son demasiadas cosas de una vez.' })
  @ValidateNested({ each: true })
  @Type(() => BatchItemDto)
  items!: BatchItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => AliasDto)
  aliases?: AliasDto[];

  /** La foto pendiente que se acaba de completar (se borra). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  photoId?: string;
}

/** «Foto ahora, anoto después»: la foto en base64, ya achicada por el teléfono. */
export class PhotoDto {
  @Matches(DATE_KEY, DATE_MSG)
  date!: string;

  @IsEnum(MealSlot, { message: 'Comida no válida.' })
  meal!: MealSlot;

  @IsString()
  @MinLength(100, { message: 'La foto llegó vacía.' })
  @MaxLength(6_000_000, { message: 'La foto es muy grande (máximo 4 MB).' })
  image!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp'], { message: 'La foto debe ser JPEG, PNG o WebP.' })
  mime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La nota es muy larga.' })
  note?: string;
}

export class WaterDto {
  @Matches(DATE_KEY, DATE_MSG)
  date!: string;

  @IsInt({ message: 'El agua va en mililitros.' })
  @Min(-5000)
  @Max(5000)
  deltaMl!: number;
}

export class SavedMealCreateDto {
  @IsString()
  @MinLength(1, { message: 'Ponle un nombre.' })
  @MaxLength(80, { message: 'El nombre es demasiado largo.' })
  name!: string;

  /** La comida que se guarda: lo anotado ese día en esa comida. */
  @Matches(DATE_KEY, DATE_MSG)
  date!: string;

  @IsEnum(MealSlot, { message: 'Comida no válida.' })
  meal!: MealSlot;
}

export class SavedMealUpdateDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Ponle un nombre.' })
  @MaxLength(80, { message: 'El nombre es demasiado largo.' })
  name?: string;

  /** Lo que se queda (lo demás se quita). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Deja al menos una cosa en la comida guardada.' })
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  itemIds?: string[];
}

export class SavedMealLogDto {
  @Matches(DATE_KEY, DATE_MSG)
  date!: string;

  @IsEnum(MealSlot, { message: 'Comida no válida.' })
  meal!: MealSlot;

  /** Solo estas cosas (por defecto, todas). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos una cosa.' })
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  itemIds?: string[];
}

export class RecipeIngredientDto {
  @IsString()
  @MaxLength(40)
  foodId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  portionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  portionLabel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1, { message: 'Los gramos deben ser mayores que cero.' })
  @Max(20000, { message: 'Son demasiados gramos para un ingrediente.' })
  grams?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.05, { message: 'La cantidad debe ser mayor que cero.' })
  @Max(200, { message: 'La cantidad es demasiado grande.' })
  quantity?: number;
}

/** Receta propia: ingredientes de la olla entera y cuántas porciones salen. */
export class RecipeDto {
  @IsString()
  @MinLength(2, { message: 'Escribe el nombre de la receta.' })
  @MaxLength(120, { message: 'El nombre es demasiado largo.' })
  name!: string;

  @IsNumber({}, { message: 'Di cuántas porciones salen.' })
  @Min(0.5, { message: 'Debe salir al menos media porción.' })
  @Max(100, { message: 'Son demasiadas porciones.' })
  servings!: number;

  /** Lo que pesó la olla al final (opcional). */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50000, { message: 'Revisa el peso de la olla.' })
  cookedGrams?: number | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un ingrediente.' })
  @ArrayMaxSize(80, { message: 'Son demasiados ingredientes.' })
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
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

  /** Lo de los empacados (para los sellos de advertencia). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  satFat?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  transFat?: number;

  @IsOptional()
  @IsBoolean()
  sweetener?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  /** Código de barras del empaque (de 8 a 14 números). */
  @IsOptional()
  @Matches(/^\d{8,14}$/, { message: 'El código de barras son de 8 a 14 números.' })
  barcode?: string;
}

/** Buscar empacados en Open Food Facts. */
export class OffSearchDto {
  @IsString()
  @MinLength(2, { message: 'Escribe al menos dos letras.' })
  @MaxLength(80)
  q!: string;
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

  /** Agua al día, en mililitros. */
  @IsOptional()
  @IsInt()
  @Min(500, { message: 'La meta de agua debe estar entre 500 y 8.000 ml.' })
  @Max(8000, { message: 'La meta de agua debe estar entre 500 y 8.000 ml.' })
  waterGoalMl?: number;

  /** Tamaño del vaso, en mililitros. */
  @IsOptional()
  @IsInt()
  @Min(100, { message: 'El vaso debe tener entre 100 y 1.000 ml.' })
  @Max(1000, { message: 'El vaso debe tener entre 100 y 1.000 ml.' })
  glassMl?: number;
}
