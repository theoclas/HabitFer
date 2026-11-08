import {
  Body,
  Controller,
  Get,
  GoneException,
  HttpException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TaskStatus, UserStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { HabitsService } from '../habits/habits.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { ActionLinksService } from './action-links.service';
import { PushActionDto, PushSettingsDto, SubscribeDto, UnsubscribeDto } from './push.dto';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(
    private push: PushService,
    private habits: HabitsService,
    private tasks: TasksService,
    private prisma: PrismaService,
    private links: ActionLinksService,
  ) {}

  /**
   * Enlace corto de WhatsApp (/a/<código>): devuelve lo mismo que el fragmento de /accion.
   * Sin sesión, como el botón «Hecho». 410 si ya venció.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('link/:code')
  async link(@Param('code') code: string) {
    const link = await this.links.resolve(code);
    if (!link) throw new GoneException('Este enlace ya venció (duran 36 horas). Márcalo desde la app.');
    return link;
  }

  @Get('public-key')
  publicKey() {
    return { publicKey: this.push.getPublicKey() };
  }

  @Get('settings')
  async settings(@CurrentUser() user: AuthUserPayload) {
    const row = await this.prisma.user.findUnique({ where: { id: user.userId }, select: { habitSummaryTime: true } });
    return {
      enabled: this.push.enabled,
      devices: await this.push.devices(user.userId),
      summaryTime: row?.habitSummaryTime ?? null,
    };
  }

  @Patch('settings')
  async updateSettings(@CurrentUser() user: AuthUserPayload, @Body() dto: PushSettingsDto) {
    if (dto.summaryTime !== undefined) {
      await this.prisma.user.update({ where: { id: user.userId }, data: { habitSummaryTime: dto.summaryTime ?? null } });
    }
    return this.settings(user);
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: AuthUserPayload, @Body() dto: SubscribeDto) {
    return this.push.subscribe(user.userId, dto);
  }

  @Post('unsubscribe')
  unsubscribe(@CurrentUser() user: AuthUserPayload, @Body() dto: UnsubscribeDto) {
    return this.push.unsubscribe(user.userId, dto.endpoint);
  }

  @Post('test')
  test(@CurrentUser() user: AuthUserPayload) {
    return this.push.sendToUser(user.userId, {
      title: '🔥 HabitFer',
      body: 'Así te van a llegar los recordatorios.',
      tag: 'hf-test',
      url: '/app/habitfer',
    });
  }

  /**
   * Boton "Hecho" de la notificacion: lo llama el service worker sin sesion,
   * con el token de un solo proposito que viajo dentro del push.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('action')
  async action(@Body() dto: PushActionDto) {
    const claims = this.push.verifyActionToken(dto.token);
    const owner = await this.prisma.user.findUnique({ where: { id: claims.sub }, select: { status: true } });
    if (owner?.status !== UserStatus.ACTIVE) throw new UnauthorizedException();

    try {
      if (claims.act === 'habit-done' || claims.act === 'habit-add') {
        const result =
          claims.act === 'habit-add'
            ? await this.habits.addStep(claims.sub, claims.tid, claims.d)
            : await this.habits.complete(claims.sub, claims.tid, { date: claims.d });
        const h = result.habit;
        const won = result.unlockedAchievement ?? result.challengeWon;
        return {
          ok: true,
          kind: 'habit',
          title: h.title,
          streak: h.currentStreak,
          streakUnit: h.streakUnit,
          done: result.done,
          // En los medibles, cuanto lleva: "3 de 8 vasos".
          message: h.goal > 1 ? `${result.value} de ${h.goal}${h.unit ? ` ${h.unit}` : ''}${result.done ? ' · meta cumplida' : ''}` : null,
          achievement: won ? { days: won.milestoneDays, label: won.label, headline: won.headline } : null,
        };
      }
      const task = await this.tasks.updateTask(claims.sub, claims.tid, { status: TaskStatus.DONE });
      return { ok: true, kind: 'task', title: task.title };
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() < 500) return { ok: false, message: err.message };
      throw err;
    }
  }
}
