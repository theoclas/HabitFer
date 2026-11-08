import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private stats: StatsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUserPayload) {
    return this.stats.overview(user.userId);
  }

  @Get('range')
  range(
    @CurrentUser() user: AuthUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('habitId') habitId?: string,
  ) {
    return this.stats.range(user.userId, from, to, habitId || undefined);
  }

  @Get('habits/:id')
  habit(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.stats.habitDetail(user.userId, id);
  }

  @Get('tasks')
  tasks(@CurrentUser() user: AuthUserPayload) {
    return this.stats.tasksSummary(user.userId);
  }
}
