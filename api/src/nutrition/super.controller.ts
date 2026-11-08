import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { localTodayKey } from '../common/date.utils';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { NutritionExportService } from './export/nutrition-export.service';
import { FastingService } from './fasting/fasting.service';
import { FoodsService } from './foods.service';
import { isAutoSource, type AutoSource } from './habits/auto-values';
import { NutriHabitsService } from './habits/nutri-habits.service';
import {
  FastSettingsDto,
  FastStartDto,
  FastStopDto,
  FastUpdateDto,
  HabitLinkDto,
  MonthQueryDto,
  PlanAddDto,
  PlanCopyDto,
  PlanUpdateDto,
  PlanWeekQueryDto,
} from './nutrition.dto';
import { MealPlanService } from './plan/meal-plan.service';
import { ProgressService } from './progress/progress.service';

function source(value: string): AutoSource {
  if (!isAutoSource(value)) throw new BadRequestException('Esa conexión no existe.');
  return value;
}

/** NutriFer «super app»: ayuno, conexión con HabitFer, plan y mercado, tu mes en comida y respaldo. */
@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionSuperController {
  constructor(
    private fasting: FastingService,
    private nutriHabits: NutriHabitsService,
    private plan: MealPlanService,
    private progress: ProgressService,
    private exporter: NutritionExportService,
    private foods: FoodsService,
  ) {}

  /* ---------- Ayuno ---------- */

  @Get('fasting')
  fastingView(@CurrentUser() user: AuthUserPayload) {
    return this.fasting.view(user.userId);
  }

  @Post('fasting/start')
  fastingStart(@CurrentUser() user: AuthUserPayload, @Body() dto: FastStartDto) {
    return this.fasting.start(user.userId, dto);
  }

  @Post('fasting/stop')
  fastingStop(@CurrentUser() user: AuthUserPayload, @Body() dto: FastStopDto) {
    return this.fasting.stop(user.userId, dto);
  }

  @Put('fasting/settings')
  fastingSettings(@CurrentUser() user: AuthUserPayload, @Body() dto: FastSettingsDto) {
    return this.fasting.settings(user.userId, dto);
  }

  @Patch('fasting/:id')
  fastingUpdate(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: FastUpdateDto) {
    return this.fasting.update(user.userId, id, dto);
  }

  @Delete('fasting/:id')
  fastingRemove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.fasting.remove(user.userId, id);
  }

  /* ---------- Conexión con HabitFer ---------- */

  @Get('habits')
  habits(@CurrentUser() user: AuthUserPayload) {
    return this.nutriHabits.list(user.userId);
  }

  /** Conectar un hábito que ya existe (sin habitId: desconectar). */
  @Put('habits/:source')
  habitLink(@CurrentUser() user: AuthUserPayload, @Param('source') src: string, @Body() dto: HabitLinkDto) {
    return this.nutriHabits.link(user.userId, source(src), dto.habitId?.trim() || null);
  }

  /** Crear en HabitFer el hábito ya conectado. */
  @Post('habits/:source')
  habitCreate(@CurrentUser() user: AuthUserPayload, @Param('source') src: string) {
    return this.nutriHabits.create(user.userId, source(src));
  }

  /* ---------- Plan de la semana y mercado ---------- */

  @Get('plan')
  planWeek(@CurrentUser() user: AuthUserPayload, @Query() q: PlanWeekQueryDto) {
    return this.plan.week(user.userId, q.from);
  }

  @Post('plan')
  planAdd(@CurrentUser() user: AuthUserPayload, @Body() dto: PlanAddDto) {
    return this.plan.add(user.userId, dto);
  }

  @Post('plan/copy')
  planCopy(@CurrentUser() user: AuthUserPayload, @Body() dto: PlanCopyDto) {
    return this.plan.copyWeek(user.userId, dto.from, dto.to);
  }

  @Patch('plan/:id')
  planUpdate(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: PlanUpdateDto) {
    return this.plan.update(user.userId, id, dto);
  }

  @Delete('plan/:id')
  planRemove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.plan.remove(user.userId, id);
  }

  /** Anotar en el diario lo planeado. */
  @Post('plan/:id/log')
  planLog(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.plan.log(user.userId, id);
  }

  /* ---------- Cadenas colombianas ---------- */

  /** Dónde ver las calorías de cada cadena (si las publica) y los platos propios de cada una. */
  @Get('chains')
  chains(@CurrentUser() user: AuthUserPayload) {
    return this.foods.chains(user.userId);
  }

  /* ---------- Tu mes en comida ---------- */

  @Get('month')
  month(@CurrentUser() user: AuthUserPayload, @Query() q: MonthQueryDto) {
    return this.progress.month(user.userId, q.month);
  }

  /* ---------- Respaldo ---------- */

  @Get('export')
  async exportJson(@CurrentUser() user: AuthUserPayload, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="nutrifer-respaldo-${localTodayKey()}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    return this.exporter.exportJson(user.userId);
  }

  @Get('export/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async exportCsv(@CurrentUser() user: AuthUserPayload, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="nutrifer-diario-${localTodayKey()}.csv"`);
    return this.exporter.exportCsv(user.userId);
  }

  @Post('export/import')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  importJson(@CurrentUser() user: AuthUserPayload, @Body() body: unknown) {
    return this.exporter.importJson(user.userId, body);
  }
}
