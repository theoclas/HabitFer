import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import {
  CopyRoutineDto,
  HistoryQueryDto,
  HomeQueryDto,
  MoveDto,
  PlanDto,
  RangeQueryDto,
  RoutineDto,
  SettingsDto,
  StartProgramDto,
  WeekQueryDto,
  WorkoutDto,
  WorkoutUpdateDto,
} from './fit.dto';
import { FitPlanService } from './fit-plan.service';
import { FitService } from './fit.service';
import { library } from './library';

/** FerFit: biblioteca de ejercicios, rutinas propias, lo que se chuleó y la racha. */
@Controller('fit')
@UseGuards(JwtAuthGuard)
export class FitController {
  constructor(
    private fit: FitService,
    private plan: FitPlanService,
  ) {}

  /** Ejercicios (con su figura) y rutinas listas. No cambia mientras la API corre. */
  @Get('library')
  library(@Res({ passthrough: true }) res: Response) {
    const lib = library();
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('ETag', `"${lib.version}"`);
    return lib.body;
  }

  /** Hoy: la racha, lo chuleado ese día y las rutinas propias. */
  @Get('home')
  home(@CurrentUser() user: AuthUserPayload, @Query() query: HomeQueryDto) {
    return this.fit.home(user.userId, query.date);
  }

  @Get('routines')
  routines(@CurrentUser() user: AuthUserPayload) {
    return this.fit.routines(user.userId);
  }

  @Get('routines/:id')
  routine(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.fit.routine(user.userId, id);
  }

  @Post('routines')
  createRoutine(@CurrentUser() user: AuthUserPayload, @Body() dto: RoutineDto) {
    return this.fit.createRoutine(user.userId, dto);
  }

  /** Copiar una rutina lista a «Mis rutinas». */
  @Post('routines/copy')
  copyReady(@CurrentUser() user: AuthUserPayload, @Body() dto: CopyRoutineDto) {
    return this.fit.copyReady(user.userId, dto.readyKey);
  }

  @Put('routines/:id')
  updateRoutine(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: RoutineDto) {
    return this.fit.updateRoutine(user.userId, id, dto);
  }

  @Delete('routines/:id')
  removeRoutine(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.fit.removeRoutine(user.userId, id);
  }

  /** La última vez de cada ejercicio con series anotadas: ?keys=sentadilla,flexion-pared */
  @Get('history')
  history(@CurrentUser() user: AuthUserPayload, @Query() query: HistoryQueryDto) {
    return this.fit.history(user.userId, query.keys.split(','));
  }

  @Get('workouts')
  workouts(@CurrentUser() user: AuthUserPayload, @Query() query: RangeQueryDto) {
    return this.fit.workouts(user.userId, query.from, query.to);
  }

  /** Chulear: una rutina (toda o ejercicio por ejercicio) o una actividad suelta. */
  @Post('workouts')
  saveWorkout(@CurrentUser() user: AuthUserPayload, @Body() dto: WorkoutDto) {
    return this.fit.saveWorkout(user.userId, dto);
  }

  @Patch('workouts/:id')
  updateWorkout(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: WorkoutUpdateDto) {
    return this.fit.updateWorkout(user.userId, id, dto);
  }

  @Delete('workouts/:id')
  removeWorkout(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.fit.removeWorkout(user.userId, id);
  }

  @Put('settings')
  settings(@CurrentUser() user: AuthUserPayload, @Body() dto: SettingsDto) {
    return this.fit.setSettings(user.userId, dto);
  }

  /* ---------- La semana ---------- */

  /** La semana de esa fecha (o la de hoy): lo planeado cada día y cómo va, el plan, el programa y los ajustes. */
  @Get('week')
  week(@CurrentUser() user: AuthUserPayload, @Query() query: WeekQueryDto) {
    return this.plan.week(user.userId, query.date);
  }

  /** El plan de la semana: una rutina por día; los que no vienen quedan de descanso. */
  @Put('plan')
  setPlan(@CurrentUser() user: AuthUserPayload, @Body() dto: PlanDto) {
    return this.plan.setPlan(user.userId, dto.days);
  }

  /** Pasar una rutina planeada a otro día de la misma semana. */
  @Post('plan/moves')
  move(@CurrentUser() user: AuthUserPayload, @Body() dto: MoveDto) {
    return this.plan.move(user.userId, dto);
  }

  @Delete('plan/moves/:id')
  undoMove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.plan.undoMove(user.userId, id);
  }

  @Post('programs/start')
  startProgram(@CurrentUser() user: AuthUserPayload, @Body() dto: StartProgramDto) {
    return this.plan.startProgram(user.userId, dto);
  }

  @Post('programs/stop')
  stopProgram(@CurrentUser() user: AuthUserPayload) {
    return this.plan.stopProgram(user.userId);
  }
}
