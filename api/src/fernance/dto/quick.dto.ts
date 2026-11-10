import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsMoney } from './validators';

const TEXT_MSG = { message: 'Escribe algo como «almuerzo 18 lucas nequi».' };

export class ParseTextDto {
  @IsString(TEXT_MSG)
  @MaxLength(500, {
    message: 'El texto es demasiado largo (máximo 500 letras).',
  })
  text!: string;
}

/** Enseñarle una palabra: que lleve a una categoría o a una cuenta. */
export class CreateKeywordDto {
  @IsString({ message: 'Escribe la palabra.' })
  @Matches(/[a-zA-ZÀ-ÿ0-9]/, { message: 'Escribe la palabra.' })
  @MaxLength(60, {
    message: 'La palabra es demasiado larga (máximo 60 letras).',
  })
  keyword!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}

const SHORTCUT_TYPES = ['EXPENSE', 'INCOME'] as const;

export class CreateShortcutDto {
  @IsString({ message: 'Ponle un nombre.' })
  @Matches(/\S/, { message: 'Ponle un nombre.' })
  @MaxLength(40, {
    message: 'El nombre es demasiado largo (máximo 40 letras).',
  })
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16, { message: 'El ícono debe ser un emoji.' })
  icon?: string;

  @IsOptional()
  @IsIn(SHORTCUT_TYPES, { message: 'El tipo debe ser gasto o ingreso.' })
  type?: (typeof SHORTCUT_TYPES)[number];

  @IsMoney('El monto')
  amount!: number;

  @IsString({ message: 'Elige una cuenta.' })
  accountId!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120, {
    message: 'El comercio es demasiado largo (máximo 120 letras).',
  })
  merchant?: string;
}

export class UpdateShortcutDto {
  @IsOptional()
  @IsString({ message: 'Ponle un nombre.' })
  @Matches(/\S/, { message: 'Ponle un nombre.' })
  @MaxLength(40, {
    message: 'El nombre es demasiado largo (máximo 40 letras).',
  })
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16, { message: 'El ícono debe ser un emoji.' })
  icon?: string;

  @IsOptional()
  @IsMoney('El monto')
  amount?: number;

  @IsOptional()
  @IsString({ message: 'Elige una cuenta.' })
  accountId?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120, {
    message: 'El comercio es demasiado largo (máximo 120 letras).',
  })
  merchant?: string;
}
