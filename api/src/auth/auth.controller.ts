import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ACCESS_COOKIE } from './jwt.strategy';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === 'false') return false;
  if (process.env.COOKIE_SECURE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: cookieSecure(),
  sameSite: 'strict' as const,
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.register(dto).then((result) => {
      if ('token' in result && result.token) {
        res.cookie(ACCESS_COOKIE, result.token, COOKIE_OPTS);
      }
      return result;
    });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto).then((result) => {
      res.cookie(ACCESS_COOKIE, result.token, COOKIE_OPTS);
      return result;
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/', httpOnly: true, sameSite: 'strict' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUserPayload) {
    return this.auth.me(user.userId);
  }
}
