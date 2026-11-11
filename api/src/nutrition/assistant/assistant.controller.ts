import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AgentKeysService } from './agent-keys.service';
import {
  renderAssistantMarkdown,
  type AssistantReport,
} from './assistant-report';
import {
  AgentFoodsQueryDto,
  AgentReportQueryDto,
  CreateAgentKeyDto,
} from './assistant.dto';
import { AssistantService } from './assistant.service';

/** JSON por defecto; Markdown con ?format=md (para pegarlo en un chat). Nunca en caché: son datos de salud. */
function send(
  res: Response,
  report: AssistantReport,
  format: 'json' | 'md' | undefined,
) {
  res.setHeader('Cache-Control', 'no-store');
  if (format !== 'md') return report;
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  return renderAssistantMarkdown(report);
}

/**
 * La API para un asistente (Claude). No usa la sesión: usa una llave de NutriFer › Meta › Claude en
 * `Authorization: Bearer nfa_…`. Solo lee: no hay nada aquí que anote, cambie o borre.
 *
 *   GET /api/nutrition/agent/report?days=14&format=md   (o ?from=AAAA-MM-DD&to=AAAA-MM-DD; format=json por defecto)
 *   GET /api/nutrition/agent/foods?q=arepa&limit=10      (la base de NutriFer con valores por 100 g y medidas)
 */
@Controller('nutrition/agent')
@Public()
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class NutritionAgentController {
  constructor(
    private keys: AgentKeysService,
    private assistant: AssistantService,
  ) {}

  @Get('report')
  async report(
    @Headers('authorization') auth: string | undefined,
    @Query() query: AgentReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.keys.resolve(auth);
    return send(res, await this.assistant.report(userId, query), query.format);
  }

  @Get('foods')
  async foods(
    @Headers('authorization') auth: string | undefined,
    @Query() query: AgentFoodsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.keys.resolve(auth);
    res.setHeader('Cache-Control', 'no-store');
    return this.assistant.searchFoods(userId, query.q, query.limit ?? 10);
  }
}

/** Desde la app, con la sesión: las llaves para Claude y el informe para copiarlo. */
@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionAssistantController {
  constructor(
    private keys: AgentKeysService,
    private assistant: AssistantService,
  ) {}

  @Get('agent-keys')
  keyList(@CurrentUser() user: AuthUserPayload) {
    return this.keys.list(user.userId);
  }

  /** Llave nueva; se muestra una sola vez. */
  @Post('agent-keys')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  keyCreate(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateAgentKeyDto,
  ) {
    return this.keys.create(user.userId, dto.name);
  }

  @Delete('agent-keys/:id')
  keyRemove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.keys.remove(user.userId, id);
  }

  /** El mismo informe que lee Claude, para copiarlo y pegarlo en cualquier chat. */
  @Get('agent-report')
  async report(
    @CurrentUser() user: AuthUserPayload,
    @Query() query: AgentReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(
      res,
      await this.assistant.report(user.userId, query),
      query.format,
    );
  }
}
