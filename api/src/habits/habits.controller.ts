import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CompleteHabitDto } from './dto/complete-habit.dto';
import { CreateHabitDto } from './dto/create-habit.dto';
import { BulkCreateHabitsDto, CreatePauseDto, RelapseDto, ReorderHabitsDto, SetProgressDto } from './dto/habit-actions.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { HabitsService } from './habits.service';

@Controller('habits')
@UseGuards(JwtAuthGuard)
export class HabitsController {
  constructor(private habits: HabitsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload) {
    return this.habits.list(user.userId);
  }

  // Rutas fijas antes que las de :id.

  @Get('today')
  today(@CurrentUser() user: AuthUserPayload, @Query('date') date?: string) {
    return this.habits.today(user.userId, date);
  }

  @Get('archived')
  archived(@CurrentUser() user: AuthUserPayload) {
    return this.habits.listArchived(user.userId);
  }

  @Get('achievements')
  achievementsSummary(@CurrentUser() user: AuthUserPayload) {
    return this.habits.achievementsSummary(user.userId);
  }

  @Get('freezes')
  freezes(@CurrentUser() user: AuthUserPayload) {
    return this.habits.freezeBalance(user.userId);
  }

  @Get('pauses')
  pauses(@CurrentUser() user: AuthUserPayload) {
    return this.habits.listPauses(user.userId);
  }

  @Post('pauses')
  createPause(@CurrentUser() user: AuthUserPayload, @Body() dto: CreatePauseDto) {
    return this.habits.createPause(user.userId, dto);
  }

  @Delete('pauses/:pauseId')
  endPause(@CurrentUser() user: AuthUserPayload, @Param('pauseId') pauseId: string) {
    return this.habits.endPause(user.userId, pauseId);
  }

  @Post('reorder')
  reorder(@CurrentUser() user: AuthUserPayload, @Body() dto: ReorderHabitsDto) {
    return this.habits.reorder(user.userId, dto.ids);
  }

  @Post('bulk')
  createMany(@CurrentUser() user: AuthUserPayload, @Body() dto: BulkCreateHabitsDto) {
    return this.habits.createMany(user.userId, dto.habits);
  }

  @Get(':id/achievements')
  achievements(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.habits.listAchievements(user.userId, id);
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

  /** Cantidad del dia en un habito medible. */
  @Put(':id/progress/:date')
  setProgress(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Param('date') date: string,
    @Body() dto: SetProgressDto,
  ) {
    return this.habits.setProgress(user.userId, id, date, dto);
  }

  @Post(':id/relapse')
  relapse(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: RelapseDto) {
    return this.habits.relapse(user.userId, id, dto);
  }

  @Delete(':id/relapse/:date')
  removeRelapse(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Param('date') date: string) {
    return this.habits.removeRelapse(user.userId, id, date);
  }

  @Post(':id/freeze/:date')
  freeze(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Param('date') date: string) {
    return this.habits.freeze(user.userId, id, date);
  }

  @Delete(':id/freeze/:date')
  unfreeze(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Param('date') date: string) {
    return this.habits.unfreeze(user.userId, id, date);
  }
}
