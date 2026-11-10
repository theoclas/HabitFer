import { CreditStatus, FinanceAccountType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_INSTALLMENTS } from '../fernance.utils';
import { IsDateKey, IsMoney } from './validators';

const ACCOUNT_MSG = { message: 'Elige una cuenta.' };
const NAME_MSG = { message: 'El nombre no puede quedar vacío.' };
const STATUS_MSG = {
  message: 'El estado no es válido (ACTIVE, PAID_OFF o CANCELLED).',
};

export class CreateCreditDto {
  @IsString(ACCOUNT_MSG)
  @Matches(/\S/, ACCOUNT_MSG)
  accountId!: string;

  @IsString(NAME_MSG)
  @Matches(/\S/, NAME_MSG)
  @MaxLength(120, {
    message: 'El nombre es demasiado largo (máximo 120 letras).',
  })
  name!: string;

  @IsMoney('El valor total')
  totalAmount!: number;

  @IsMoney('La cuota')
  installmentAmount!: number;

  @IsDateKey({ message: 'La fecha de la primera cuota no es válida.' })
  firstDueDate!: string;
}

export class UpdateCreditDto {
  @IsOptional()
  @IsString(NAME_MSG)
  @Matches(/\S/, NAME_MSG)
  @MaxLength(120, {
    message: 'El nombre es demasiado largo (máximo 120 letras).',
  })
  name?: string;

  @IsOptional()
  @IsString(ACCOUNT_MSG)
  @Matches(/\S/, ACCOUNT_MSG)
  accountId?: string;

  /** ACTIVE = reactivar (queda pagado si ya no debe nada), CANCELLED = cancelar, PAID_OFF solo si no quedan cuotas. */
  @IsOptional()
  @IsEnum(CreditStatus, STATUS_MSG)
  status?: CreditStatus;

  /** Cuota de referencia (la que se muestra en la lista). */
  @IsOptional()
  @IsMoney('La cuota')
  installmentAmount?: number;
}

/** Rehacer las cuotas que faltan: las pagadas se quedan como están. */
export class ReplanCreditDto {
  @IsInt({ message: 'El número de cuotas debe ser un número entero.' })
  @Min(1, { message: 'Debe quedar al menos una cuota.' })
  @Max(MAX_INSTALLMENTS, {
    message: `El máximo es ${MAX_INSTALLMENTS} cuotas.`,
  })
  count!: number;

  @IsMoney('La cuota')
  amount!: number;

  @IsDateKey({ message: 'La fecha de la próxima cuota no es válida.' })
  firstDueDate!: string;

  @IsOptional()
  @IsMoney('La última cuota')
  lastAmount?: number;
}

export class UpdateInstallmentDto {
  @IsOptional()
  @IsDateKey({ message: 'La fecha de la cuota no es válida.' })
  dueDate?: string;

  @IsOptional()
  @IsMoney('El valor de la cuota')
  amount?: number;
}

export class PayInstallmentDto {
  /** Día en que pagaste. Por defecto, hoy. */
  @IsOptional()
  @IsDateKey({ message: 'La fecha del pago no es válida.' })
  paidDate?: string;

  /** Lo que pagaste de verdad. Por defecto, el valor de la cuota. */
  @IsOptional()
  @IsMoney('El valor pagado')
  paidAmount?: number;

  /** Cuenta de donde salió la plata. Por defecto, la del crédito. */
  @IsOptional()
  @IsString(ACCOUNT_MSG)
  @Matches(/\S/, ACCOUNT_MSG)
  accountId?: string;
}

const BOOK_MSG = {
  message: 'El libro no es válido (Personal, Negocio u Otro).',
};

export class ListCreditsQuery {
  @IsOptional()
  @IsString()
  accountId?: string;

  /** Solo los créditos de las cuentas de un libro. */
  @IsOptional()
  @IsEnum(FinanceAccountType, BOOK_MSG)
  book?: FinanceAccountType;

  @IsOptional()
  @IsEnum(CreditStatus, STATUS_MSG)
  status?: CreditStatus;
}

export class SummaryQuery {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsEnum(FinanceAccountType, BOOK_MSG)
  book?: FinanceAccountType;

  @IsOptional()
  @IsDateKey({ message: 'La fecha «desde» no es válida (usa AAAA-MM-DD).' })
  from?: string;

  @IsOptional()
  @IsDateKey({ message: 'La fecha «hasta» no es válida (usa AAAA-MM-DD).' })
  to?: string;
}
