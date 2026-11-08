import { Type } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { HHMM } from '../reminders/reminder-text.utils';

export class PushKeysDto {
  @IsString()
  @MaxLength(200)
  p256dh!: string;

  @IsString()
  @MaxLength(100)
  auth!: string;
}

export class SubscribeDto {
  @IsString()
  @MaxLength(700)
  @Matches(/^https?:\/\//)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  userAgent?: string;
}

export class UnsubscribeDto {
  @IsString()
  @MaxLength(700)
  endpoint!: string;
}

export class PushSettingsDto {
  /** Hora del resumen nocturno (HH:mm) o null para apagarlo. */
  @IsOptional()
  @IsString()
  @Matches(HHMM)
  summaryTime?: string | null;

  /** Hora del mensaje de la mañana (HH:mm) o null para apagarlo. */
  @IsOptional()
  @IsString()
  @Matches(HHMM)
  morningTime?: string | null;
}

export class PushActionDto {
  @IsString()
  @MaxLength(2000)
  token!: string;
}
