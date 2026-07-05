import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CompleteHabitDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
