import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CoachService } from './coach.service';

class CoachSettingsDto {
  @IsBoolean({ message: 'enabled debe ser verdadero o falso.' })
  enabled!: boolean;
}

@Controller('coach')
@UseGuards(JwtAuthGuard)
export class CoachController {
  constructor(private coach: CoachService) {}

  /** Estado del coach y el ultimo mensaje. */
  @Get()
  state(@CurrentUser() user: AuthUserPayload) {
    return this.coach.state(user.userId);
  }

  /** Pedir el mensaje de esta semana ahora (uno por semana). */
  @Post('generate')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  generate(@CurrentUser() user: AuthUserPayload) {
    return this.coach.generateNow(user.userId);
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.coach.markRead(user.userId, id);
  }

  @Patch('settings')
  settings(@CurrentUser() user: AuthUserPayload, @Body() dto: CoachSettingsDto) {
    return this.coach.setEnabled(user.userId, dto.enabled);
  }
}
