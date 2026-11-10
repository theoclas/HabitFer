import { FinanceAccountType } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const NAME_MSG = { message: 'El nombre no puede quedar vacío.' };
const TYPE_MSG = { message: 'El tipo de cuenta no es válido.' };
const COLOR_MSG = { message: 'El color debe ser como #D4AF37.' };

export class CreateFinanceAccountDto {
  @IsString(NAME_MSG)
  @Matches(/\S/, NAME_MSG)
  @MaxLength(120, {
    message: 'El nombre es demasiado largo (máximo 120 letras).',
  })
  name!: string;

  @IsOptional()
  @IsEnum(FinanceAccountType, TYPE_MSG)
  type?: FinanceAccountType;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, COLOR_MSG)
  color?: string;
}

export class UpdateFinanceAccountDto {
  @IsOptional()
  @IsString(NAME_MSG)
  @Matches(/\S/, NAME_MSG)
  @MaxLength(120, {
    message: 'El nombre es demasiado largo (máximo 120 letras).',
  })
  name?: string;

  @IsOptional()
  @IsEnum(FinanceAccountType, TYPE_MSG)
  type?: FinanceAccountType;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, COLOR_MSG)
  color?: string;
}

export class ListAccountsQuery {
  /** «1» = incluir las archivadas (la papelera). */
  @IsOptional()
  @IsIn(['0', '1'], { message: 'archivadas debe ser 0 o 1.' })
  archivadas?: string;
}
