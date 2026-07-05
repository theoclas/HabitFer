import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { RemindersService } from './reminders.service';

@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private reminders: RemindersService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload) {
    return this.reminders.syncAndList(user.userId);
  }

  @Get('count')
  count(@CurrentUser() user: AuthUserPayload) {
    return this.reminders.countUnread(user.userId);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.reminders.markRead(user.userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUserPayload) {
    return this.reminders.markAllRead(user.userId);
  }
}
