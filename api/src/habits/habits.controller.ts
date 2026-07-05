import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CompleteHabitDto } from './dto/complete-habit.dto';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { HabitsService } from './habits.service';

@Controller('habits')
@UseGuards(JwtAuthGuard)
export class HabitsController {
  constructor(private habits: HabitsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload, @Query('archived') archived?: string) {
    return this.habits.list(user.userId, archived === 'true');
  }

  @Get('today')
  today(@CurrentUser() user: AuthUserPayload, @Query('date') date?: string) {
    return this.habits.today(user.userId, date);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.habits.getOne(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateHabitDto) {
    return this.habits.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: UpdateHabitDto) {
    return this.habits.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.habits.remove(user.userId, id);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: CompleteHabitDto) {
    return this.habits.complete(user.userId, id, dto);
  }

  @Delete(':id/complete/:date')
  uncomplete(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Param('date') date: string) {
    return this.habits.uncomplete(user.userId, id, date);
  }
}
