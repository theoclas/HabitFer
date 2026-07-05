import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CollabNotificationsService } from './notifications.service';

@Controller('proyecfer/notifications')
@UseGuards(JwtAuthGuard)
export class CollabNotificationsController {
  constructor(private notifications: CollabNotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload, @Query('unread') unread?: string) {
    return this.notifications.listForUser(user.userId, unread === '1');
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUserPayload) {
    return this.notifications.markAllRead(user.userId);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.notifications.markRead(user.userId, id);
  }
}
