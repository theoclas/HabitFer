import { FinanceCategoryKind } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const NAME_MSG = { message: 'El nombre no puede quedar vacío.' };
const COLOR_MSG = { message: 'El color debe ser como #D4AF37.' };

export class CreateCategoryDto {
  @IsString(NAME_MSG)
  @Matches(/\S/, NAME_MSG)
  @MaxLength(60, {
    message: 'El nombre es demasiado largo (máximo 60 letras).',
  })
  name!: string;

  @IsOptional()
  @IsEnum(FinanceCategoryKind, { message: 'El tipo debe ser gasto o ingreso.' })
  kind?: FinanceCategoryKind;

  /** Para crearla como subcategoría. */
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16, { message: 'El ícono debe ser un emoji.' })
  icon?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, COLOR_MSG)
  color?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString(NAME_MSG)
  @Matches(/\S/, NAME_MSG)
  @MaxLength(60, {
    message: 'El nombre es demasiado largo (máximo 60 letras).',
  })
  name?: string;

  /** null = que quede como principal. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16, { message: 'El ícono debe ser un emoji.' })
  icon?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(/^#[0-9A-Fa-f]{6}$/, COLOR_MSG)
  color?: string | null;
}

export class ListCategoriesQuery {
  /** «1» = incluir las archivadas. */
  @IsOptional()
  @IsIn(['0', '1'], { message: 'archivadas debe ser 0 o 1.' })
  archivadas?: string;
}
