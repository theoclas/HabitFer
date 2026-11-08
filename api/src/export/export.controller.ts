import { Body, Controller, Get, Header, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { toDateKey, startOfToday } from '../common/date.utils';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { ExportService } from './export.service';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private exporter: ExportService) {}

  /** Respaldo completo en JSON (se descarga como archivo). */
  @Get()
  async json(@CurrentUser() user: AuthUserPayload, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="habitfer-respaldo-${toDateKey(startOfToday())}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    return this.exporter.exportJson(user.userId);
  }

  /** Historial de habitos en CSV (para Excel u hojas de calculo). */
  @Get('csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async csv(@CurrentUser() user: AuthUserPayload, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="habitfer-historial-${toDateKey(startOfToday())}.csv"`);
    return this.exporter.exportCsv(user.userId);
  }

  /** Importa un respaldo: suma lo que falta, nunca borra ni cambia lo que ya hay. */
  @Post('import')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  import(@CurrentUser() user: AuthUserPayload, @Body() body: unknown) {
    return this.exporter.importJson(user.userId, body);
  }
}
