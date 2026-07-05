import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  icon?: string;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  icon?: string;

  @IsOptional()
  archived?: boolean;
}

export class AddWorkspaceMemberDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;
}
