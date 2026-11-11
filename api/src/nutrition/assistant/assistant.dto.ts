import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DATE_KEY } from '../nutrition.dto';
import { MAX_REPORT_DAYS } from './assistant.service';

const DATE_MSG = { message: 'La fecha debe venir como AAAA-MM-DD.' };

/** ?days=14 (los últimos días hasta hoy) o ?from=…&to=…; ?format=md para Markdown. */
export class AgentReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'days debe ser un número entero.' })
  @Min(1, { message: 'days va de 1 a 92.' })
  @Max(MAX_REPORT_DAYS, { message: 'days va de 1 a 92.' })
  days?: number;

  @IsOptional()
  @Matches(DATE_KEY, DATE_MSG)
  from?: string;

  @IsOptional()
  @Matches(DATE_KEY, DATE_MSG)
  to?: string;

  @IsOptional()
  @IsIn(['json', 'md'], { message: 'format es json o md.' })
  format?: 'json' | 'md';
}

export class AgentFoodsQueryDto {
  @IsString()
  @MinLength(2, { message: 'Escribe al menos 2 letras.' })
  @MaxLength(80)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}

export class CreateAgentKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'El nombre va hasta 60 letras.' })
  name?: string;
}
