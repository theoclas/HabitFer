import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SkipOriginCheck } from '../../common/decorators/skip-origin-check.decorator';
import { WeightService } from './weight.service';

/**
 * El atajo de iOS que manda el peso de Apple Salud. No usa la sesión (vence a las 8 horas): usa una llave propia
 * que se crea en Progreso. Acepta la llave en el cuerpo ({ llave, peso, fecha? }), en `Authorization: Bearer …`
 * o en `X-NutriFer-Llave`.
 */
@Controller('nutrition/atajo')
export class NutritionShortcutController {
  constructor(private weights: WeightService) {}

  @Public()
  @SkipOriginCheck()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('peso')
  @HttpCode(200)
  peso(
    @Headers('authorization') auth: string | undefined,
    @Headers('x-nutrifer-llave') header: string | undefined,
    @Body() body: Record<string, unknown> | undefined,
  ) {
    const bearer = auth?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const fromBody = typeof body?.llave === 'string' ? body.llave : undefined;
    return this.weights.ingest(bearer ?? header ?? fromBody, body);
  }
}
