import { CreditStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCreditDto {
  @IsString()
  @MinLength(1)
  accountId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsNumber()
  @Min(0.01)
  totalAmount!: number;

  @IsNumber()
  @Min(0.01)
  installmentAmount!: number;

  @IsDateString()
  firstDueDate!: string;
}

export class UpdateCreditDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(CreditStatus)
  status?: CreditStatus;
}
