import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReminderLevel } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { EmailRemindersService } from './email-reminders.service';

export class EmailRemindersDto {
  @IsEnum(ReminderLevel, { message: 'level debe ser OFF, SUMMARY o ALL.' })
  level!: ReminderLevel;
}

/** Avisos por correo del usuario: que le llega y un correo de prueba. */
@Controller('email-reminders')
@UseGuards(JwtAuthGuard)
export class EmailRemindersController {
  constructor(private emails: EmailRemindersService) {}

  @Get()
  get(@CurrentUser() user: AuthUserPayload) {
    return this.emails.settings(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUserPayload, @Body() dto: EmailRemindersDto) {
    return this.emails.update(user.userId, dto.level);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('test')
  test(@CurrentUser() user: AuthUserPayload) {
    return this.emails.test(user.userId);
  }
}
