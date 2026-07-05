import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  role: true,
  status: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(status?: UserStatus) {
    return this.prisma.user.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email.toLowerCase() }, { username: dto.username }] },
    });
    if (existing) throw new ConflictException('Email o usuario ya registrado');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        username: dto.username,
        fullName: dto.fullName.trim(),
        passwordHash,
        role: dto.role ?? UserRole.USER,
        status: UserStatus.ACTIVE,
        approvedAt: new Date(),
      },
      select: userSelect,
    });
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.role && dto.role !== user.role) {
      await this.assertCanChangeAdminRole(user, dto.role, actorId);
    }

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
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  async approve(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.status === UserStatus.ACTIVE) return this.selectUser(id);
    if (user.status === UserStatus.REJECTED) {
      throw new ConflictException('Usuario rechazado; crea una nueva solicitud');
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE,
        approvedAt: new Date(),
        approvedById: actorId,
      },
      select: userSelect,
    });
  }

  async reject(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role === UserRole.ADMIN && user.status === UserStatus.ACTIVE) {
      await this.assertNotLastActiveAdmin(id);
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.REJECTED, approvedAt: null, approvedById: null },
      select: userSelect,
    });
  }

  async suspend(id: string, actorId: string) {
    if (id === actorId) throw new ConflictException('No puedes suspenderte a ti mismo');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role === UserRole.ADMIN) await this.assertNotLastActiveAdmin(id);
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.SUSPENDED },
      select: userSelect,
    });
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) throw new ConflictException('No puedes eliminar tu propia cuenta');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role === UserRole.ADMIN && user.status === UserStatus.ACTIVE) {
      await this.assertNotLastActiveAdmin(id);
    }
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  private async selectUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  private async assertNotLastActiveAdmin(userId: string) {
    const admins = await this.prisma.user.count({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE, id: { not: userId } },
    });
    if (admins === 0) {
      throw new ForbiddenException('Debe existir al menos un administrador activo');
    }
  }

  private async assertCanChangeAdminRole(
    user: { id: string; role: UserRole },
    newRole: UserRole,
    actorId: string,
  ) {
    if (user.role === UserRole.ADMIN && newRole !== UserRole.ADMIN) {
      await this.assertNotLastActiveAdmin(user.id);
    }
    if (user.id === actorId && newRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No puedes quitarte el rol de administrador');
    }
  }
}
