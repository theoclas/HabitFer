import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

let schema = fs.readFileSync(path.join(root, "api/prisma/schema.prisma"), "utf8");
if (!schema.includes("enum UserRole")) {
  schema = schema.replace(
    "enum TaskPriority {",
    `enum UserRole {
  USER
  ADMIN
}

enum TaskPriority {`
  );
  schema = schema.replace(
    "  fullName     String            @db.VarChar(120)",
    "  fullName     String            @db.VarChar(120)\n  role         UserRole          @default(USER)"
  );
  fs.writeFileSync(path.join(root, "api/prisma/schema.prisma"), schema, "utf8");
}

w("api/src/common/decorators/roles.decorator.ts", `import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
`);

w("api/src/common/guards/roles.guard.ts", `import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUserPayload } from '../decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUserPayload | undefined;
    if (!user?.userId) return false;

    const dbUser = await this.prisma.user.findUnique({ where: { id: user.userId }, select: { role: true } });
    if (!dbUser) return false;
    return roles.includes(dbUser.role);
  }
}
`);

w("api/src/users/dto/create-user.dto.ts", `import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'username solo letras, numeros y _' })
  username!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
`);

w("api/src/users/dto/update-user.dto.ts", `import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_]+$/)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
`);

w("api/src/users/users.service.ts", `import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return users;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email.toLowerCase() }, { username: dto.username }] },
    });
    if (existing) throw new ConflictException('Email o usuario ya registrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        username: dto.username,
        fullName: dto.fullName.trim(),
        passwordHash,
        role: dto.role ?? UserRole.USER,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.email || dto.username) {
      const existing = await this.prisma.user.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.email ? [{ email: dto.email.toLowerCase() }] : []),
            ...(dto.username ? [{ username: dto.username }] : []),
          ],
        },
      });
      if (existing) throw new ConflictException('Email o usuario ya en uso');
    }

    const data: Record<string, unknown> = {
      email: dto.email?.toLowerCase(),
      username: dto.username,
      fullName: dto.fullName?.trim(),
      role: dto.role,
    };
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) throw new ConflictException('No puedes eliminar tu propia cuenta');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
`);

w("api/src/users/users.controller.ts", `import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserPayload) {
    return this.users.remove(id, user.userId);
  }
}
`);

w("api/src/users/users.module.ts", `import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
`);

let appModule = fs.readFileSync(path.join(root, "api/src/app.module.ts"), "utf8");
if (!appModule.includes("UsersModule")) {
  appModule = appModule.replace(
    "import { TasksModule } from './tasks/tasks.module';",
    "import { TasksModule } from './tasks/tasks.module';\nimport { UsersModule } from './users/users.module';"
  );
  appModule = appModule.replace("StatsModule,", "StatsModule,\n    UsersModule,");
  fs.writeFileSync(path.join(root, "api/src/app.module.ts"), appModule, "utf8");
}

console.log("users api ok");
