import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReminderLevel, UserRole } from '@prisma/client';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { WhatsappRemindersService } from './whatsapp-reminders.service';

export class WhatsappLevelDto {
  @IsEnum(ReminderLevel, { message: 'level debe ser OFF, SUMMARY o ALL.' })
  level!: ReminderLevel;
}

export class WhatsappNumberDto {
  @IsString({ message: 'Escribe el número.' })
  @MaxLength(30, { message: 'Ese número es muy largo.' })
  phone!: string;
}

/** Avisos por WhatsApp: los números del usuario, su nivel y (el admin) el celular que envía. */
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(private whatsapp: WhatsappRemindersService) {}

  @Get()
  get(@CurrentUser() user: AuthUserPayload) {
    return this.whatsapp.settings(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUserPayload, @Body() dto: WhatsappLevelDto) {
    return this.whatsapp.update(user.userId, dto.level);
  }

  @Post('numbers')
  addNumber(@CurrentUser() user: AuthUserPayload, @Body() dto: WhatsappNumberDto) {
    return this.whatsapp.addNumber(user.userId, dto.phone);
  }

  @Delete('numbers/:id')
  removeNumber(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.whatsapp.removeNumber(user.userId, id);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('test')
  test(@CurrentUser() user: AuthUserPayload) {
    return this.whatsapp.test(user.userId);
  }

  /* Celular que envía: solo el admin lo ve (con el QR) y lo vincula o desvincula. */

  @Get('sender')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  sender() {
    return this.whatsapp.sender();
  }

  @Post('sender/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  startSender() {
    return this.whatsapp.startSender();
  }

  @Post('sender/logout')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  logoutSender() {
    return this.whatsapp.logoutSender();
  }
}
