import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsDateKey, IsMoney } from './validators';

const ACCOUNT_MSG = { message: 'Elige una cuenta.' };

export class CreateIncomeDto {
  @IsString(ACCOUNT_MSG)
  @Matches(/\S/, ACCOUNT_MSG)
  accountId!: string;

  @IsMoney('El monto')
  amount!: number;

  @IsDateKey()
  date!: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(200, {
    message: 'La descripción es demasiado larga (máximo 200 letras).',
  })
  description?: string;
}

export class UpdateIncomeDto {
  @IsOptional()
  @IsString(ACCOUNT_MSG)
  @Matches(/\S/, ACCOUNT_MSG)
  accountId?: string;

  @IsOptional()
  @IsMoney('El monto')
  amount?: number;

  @IsOptional()
  @IsDateKey()
  date?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(200, {
    message: 'La descripción es demasiado larga (máximo 200 letras).',
  })
  description?: string;
}

export class ListIncomesQuery {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsDateKey({ message: 'La fecha «desde» no es válida (usa AAAA-MM-DD).' })
  from?: string;

  @IsOptional()
  @IsDateKey({ message: 'La fecha «hasta» no es válida (usa AAAA-MM-DD).' })
  to?: string;
}
