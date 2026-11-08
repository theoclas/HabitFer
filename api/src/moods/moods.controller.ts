import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { MoodsService } from './moods.service';

export class SetMoodDto {
  @IsInt()
  @Min(1)
  @Max(5)
  mood!: number;
}

@Controller('moods')
@UseGuards(JwtAuthGuard)
export class MoodsController {
  constructor(private moods: MoodsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.moods.list(user.userId, from, to);
  }

  @Put(':date')
  set(@CurrentUser() user: AuthUserPayload, @Param('date') date: string, @Body() dto: SetMoodDto) {
    return this.moods.set(user.userId, date, dto.mood);
  }

  @Delete(':date')
  remove(@CurrentUser() user: AuthUserPayload, @Param('date') date: string) {
    return this.moods.remove(user.userId, date);
  }
}
