import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) return raw.split(',').map((o) => o.trim()).filter(Boolean);
  return ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];
}

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

    const origin = req.headers.origin;
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException('Origin header required');
      }
      return true;
    }

    const allowed = parseAllowedOrigins();
    if (!allowed.includes(origin)) {
      throw new ForbiddenException('Origin not allowed');
    }

    return true;
  }
}
