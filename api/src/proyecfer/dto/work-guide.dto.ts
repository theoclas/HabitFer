import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWorkGuideDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;
}

export class UpdateWorkGuideDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class CreateWorkGuideStepDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tips?: string;

  @IsOptional()
  @IsInt()
  durationMin?: number;
}

export class UpdateWorkGuideStepDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tips?: string;

  @IsOptional()
  @IsInt()
  durationMin?: number | null;
}

export class ReorderStepsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  stepIds!: string[];
}

export class CreateDatabaseDto {
  @IsString()
  pageId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;
}

export class AddDatabaseRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  values?: Record<string, unknown>;
}

export class UpdateDatabaseRowDto {
  @IsObject()
  values!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
