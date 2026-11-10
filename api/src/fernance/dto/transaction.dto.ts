import { FinanceAccountType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_AMOUNT } from '../fernance.utils';
import { IsBalance, IsDateKey, IsMoney } from './validators';

/** Lo que se puede anotar a mano (los ajustes salen de «Cuadrar»). */
export const USER_TX_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const;
export type UserTxType = (typeof USER_TX_TYPES)[number];
const TX_SOURCES = ['MANUAL', 'TEXT', 'SHORTCUT'] as const;
export const MOVEMENT_TYPES = [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'ADJUSTMENT',
  'INSTALLMENT',
] as const;

const ACCOUNT_MSG = { message: 'Elige una cuenta.' };
const TYPE_MSG = {
  message: 'El tipo debe ser ingreso, gasto o transferencia.',
};
const BOOK_MSG = {
  message: 'El libro no es válido (Personal, Negocio u Otro).',
};

export class CreateTransactionDto {
  @IsIn(USER_TX_TYPES, TYPE_MSG)
  type!: UserTxType;

  @IsString(ACCOUNT_MSG)
  @Matches(/\S/, ACCOUNT_MSG)
  accountId!: string;

  /** Solo en transferencias: a donde llega. */
  @IsOptional()
  @IsString({ message: 'Elige la cuenta de llegada.' })
  toAccountId?: string;

  @IsMoney('El monto')
  amount!: number;

  @IsDateKey()
  date!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString({ message: 'La categoría no es válida.' })
  categoryId?: string | null;

  @IsOptional()
  @IsString({ message: 'El comercio debe ser texto.' })
  @MaxLength(120, {
    message: 'El comercio es demasiado largo (máximo 120 letras).',
  })
  merchant?: string;

  @IsOptional()
  @IsString({ message: 'La nota debe ser texto.' })
  @MaxLength(300, {
    message: 'La nota es demasiado larga (máximo 300 letras).',
  })
  note?: string;

  @IsOptional()
  @IsIn(TX_SOURCES, { message: 'El origen no es válido.' })
  source?: (typeof TX_SOURCES)[number];

  /** Lo que se escribió («almuerzo 18 lucas nequi»). */
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'El texto es demasiado largo (máximo 500 letras).',
  })
  rawText?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(USER_TX_TYPES, TYPE_MSG)
  type?: UserTxType;

  @IsOptional()
  @IsString(ACCOUNT_MSG)
  @Matches(/\S/, ACCOUNT_MSG)
  accountId?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString({ message: 'Elige la cuenta de llegada.' })
  toAccountId?: string | null;

  /** En los ajustes puede ser negativo; en lo demás, de al menos $ 1 (lo revisa el servicio). */
  @IsOptional()
  @IsBalance('El monto')
  amount?: number;

  @IsOptional()
  @IsDateKey()
  date?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString({ message: 'La categoría no es válida.' })
  categoryId?: string | null;

  @IsOptional()
  @IsString({ message: 'El comercio debe ser texto.' })
  @MaxLength(120, {
    message: 'El comercio es demasiado largo (máximo 120 letras).',
  })
  merchant?: string;

  @IsOptional()
  @IsString({ message: 'La nota debe ser texto.' })
  @MaxLength(300, {
    message: 'La nota es demasiado larga (máximo 300 letras).',
  })
  note?: string;
}

/** Cambiar o borrar varios movimientos a la vez. */
export class BulkTransactionsDto {
  @IsArray({ message: 'Elige los movimientos.' })
  @ArrayMinSize(1, { message: 'Elige al menos un movimiento.' })
  @ArrayMaxSize(500, {
    message: 'Son demasiados movimientos de una vez (máximo 500).',
  })
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsBoolean()
  delete?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString({ message: 'La categoría no es válida.' })
  categoryId?: string | null;

  @IsOptional()
  @IsString(ACCOUNT_MSG)
  accountId?: string;

  @IsOptional()
  @IsDateKey()
  date?: string;
}

export class ListMovementsQuery {
  @IsOptional()
  @IsDateKey({ message: 'La fecha «desde» no es válida (usa AAAA-MM-DD).' })
  from?: string;

  @IsOptional()
  @IsDateKey({ message: 'La fecha «hasta» no es válida (usa AAAA-MM-DD).' })
  to?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsEnum(FinanceAccountType, BOOK_MSG)
  book?: FinanceAccountType;

  @IsOptional()
  @IsIn(MOVEMENT_TYPES, { message: 'El tipo no es válido.' })
  type?: (typeof MOVEMENT_TYPES)[number];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'La búsqueda es demasiado larga.' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El monto mínimo debe ser un número.' })
  @Min(0)
  @Max(MAX_AMOUNT)
  min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El monto máximo debe ser un número.' })
  @Min(0)
  @Max(MAX_AMOUNT)
  max?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;
}
