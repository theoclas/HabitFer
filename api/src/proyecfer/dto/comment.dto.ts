import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CommentTargetType } from '@prisma/client';

export class CreateCommentDto {
  @IsEnum(CommentTargetType)
  targetType!: CommentTargetType;

  @IsString()
  targetId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;
}
