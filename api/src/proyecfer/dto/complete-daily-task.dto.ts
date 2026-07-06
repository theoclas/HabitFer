import { IsOptional, IsString, Matches } from 'class-validator';

export class CompleteDailyTaskDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}
