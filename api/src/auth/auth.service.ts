import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type AuthUserResponse = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
};

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email.toLowerCase() }, { username: dto.username }] },
    });
    if (existing) throw new ConflictException('Email o usuario ya registrado');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const count = await this.prisma.user.count();
    const isBootstrap = count === 0;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        username: dto.username,
        fullName: dto.fullName.trim(),
        passwordHash,
        role: isBootstrap ? UserRole.ADMIN : UserRole.USER,
        status: isBootstrap ? UserStatus.ACTIVE : UserStatus.PENDING,
        approvedAt: isBootstrap ? new Date() : null,
      },
    });

    if (user.status === UserStatus.PENDING) {
      return {
        pending: true,
        message: 'Cuenta creada. Espera la aprobacion del administrador.',
        user: this.toPublicUser(user),
      };
    }

    return this.sign(user);
  }

  async login(dto: LoginDto) {
    const login = dto.login.trim();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: login.toLowerCase() }, { username: login }] },
    });
    if (!user) throw new UnauthorizedException('Credenciales invalidas');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales invalidas');
    this.assertActive(user.status);
    return this.sign(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    this.assertActive(user.status);
    return this.toPublicUser(user);
  }

  signToken(user: { id: string; email: string; username: string; role: UserRole }) {
    return this.jwt.sign(
      { sub: user.id, email: user.email, username: user.username, role: user.role },
      { expiresIn: '8h' },
    );
  }

  private sign(user: { id: string; email: string; username: string; fullName: string; role: UserRole; status: UserStatus }) {
    return {
      token: this.signToken(user),
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    username: string;
    fullName: string;
    role: UserRole;
    status: UserStatus;
  }): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };
  }

  private assertActive(status: UserStatus) {
    if (status === UserStatus.PENDING) {
      throw new ForbiddenException('Cuenta pendiente de aprobacion del administrador');
    }
    if (status === UserStatus.REJECTED) {
      throw new ForbiddenException('Cuenta rechazada. Contacta al administrador.');
    }
    if (status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Cuenta suspendida. Contacta al administrador.');
    }
  }
}
