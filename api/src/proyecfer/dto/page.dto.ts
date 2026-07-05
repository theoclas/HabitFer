import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BlockType } from '@prisma/client';

export class CreatePageDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  parentPageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  icon?: string;
}

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((o) => o.coverUrl != null && o.coverUrl !== '')
  @Matches(/^https:\/\/.+/, { message: 'coverUrl debe ser HTTPS' })
  coverUrl?: string;
}

export class BlockItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsEnum(BlockType)
  type!: BlockType;

  @IsObject()
  content!: object;

  @IsInt()
  sortOrder!: number;

  @IsOptional()
  @IsString()
  parentBlockId?: string;
}

export class SaveBlocksDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BlockItemDto)
  blocks!: BlockItemDto[];
}
