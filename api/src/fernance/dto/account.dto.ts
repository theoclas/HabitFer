import { FinanceAccountKind, FinanceAccountType } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsBalance, IsDateKey } from './validators';

const NAME_MSG = { message: 'El nombre no puede quedar vacío.' };
const TYPE_MSG = {
  message: 'El libro no es válido (Personal, Negocio u Otro).',
};
const KIND_MSG = { message: 'El tipo de cuenta no es válido.' };
const COLOR_MSG = { message: 'El color debe ser como #D4AF37.' };
const LAST4_MSG = { message: 'Los últimos dígitos son cuatro números.' };

export class CreateFinanceAccountDto {
  @IsString(NAME_MSG)
  @Matches(/\S/, NAME_MSG)
  @MaxLength(120, {
    message: 'El nombre es demasiado largo (máximo 120 letras).',
  })
  name!: string;

  /** El libro. */
  @IsOptional()
  @IsEnum(FinanceAccountType, TYPE_MSG)
  type?: FinanceAccountType;

  @IsOptional()
  @IsEnum(FinanceAccountKind, KIND_MSG)
  kind?: FinanceAccountKind;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, COLOR_MSG)
  color?: string;

  @IsOptional()
  @IsString({ message: 'El banco debe ser texto.' })
  @MaxLength(60, { message: 'El nombre del banco es demasiado largo.' })
  institution?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @Matches(/^\d{4}$/, LAST4_MSG)
  last4?: string;

  @IsOptional()
  @IsBalance('El saldo inicial')
  openingBalance?: number;
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
  @IsEnum(FinanceAccountKind, KIND_MSG)
  kind?: FinanceAccountKind;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, COLOR_MSG)
  color?: string;

  @IsOptional()
  @IsString({ message: 'El banco debe ser texto.' })
  @MaxLength(60, { message: 'El nombre del banco es demasiado largo.' })
  institution?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @Matches(/^\d{4}$/, LAST4_MSG)
  last4?: string;

  @IsOptional()
  @IsBalance('El saldo inicial')
  openingBalance?: number;
}

export class ReconcileAccountDto {
  /** El saldo que dice el banco. */
  @IsBalance('El saldo del banco')
  balance!: number;

  /** El día de ese saldo (por defecto, hoy). */
  @IsOptional()
  @IsDateKey({ message: 'La fecha del saldo no es válida.' })
  date?: string;
}

export class ListAccountsQuery {
  /** «1» = incluir las archivadas (la papelera). */
  @IsOptional()
  @IsIn(['0', '1'], { message: 'archivadas debe ser 0 o 1.' })
  archivadas?: string;
}
