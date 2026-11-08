import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

/** habit-done: marcar hecho; habit-add: sumar un toque (medibles); task-done: tarea hecha. */
export type PushAction = 'habit-done' | 'habit-add' | 'task-done';

/** Lo que recibe el service worker del telefono (ver web/sw/sw.template.js). */
export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  actions?: { action: string; title: string }[];
  data?: Record<string, unknown>;
};

type ActionClaims = { sub: string; act: PushAction; tid: string; d?: string; typ: 'push-action' };

const FOUR_HOURS = 4 * 60 * 60;

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey: string | null = null;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'https://habitfer.fersuastudio.com';
    if (!publicKey || !privateKey) {
      this.logger.warn('Notificaciones push apagadas: faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY');
      return;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.publicKey = publicKey;
  }

  get enabled(): boolean {
    return this.publicKey !== null;
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  async subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }) {
    const userAgent = sub.userAgent?.slice(0, 300) ?? null;
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    });
    return { ok: true, devices: await this.devices(userId) };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { ok: true, devices: await this.devices(userId) };
  }

  devices(userId: string) {
    return this.prisma.pushSubscription.count({ where: { userId } });
  }

  /** Envia a todos los dispositivos del usuario y borra las suscripciones que el servicio ya no reconoce. */
  async sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; removed: number }> {
    if (!this.enabled) return { sent: 0, removed: 0 };
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    const body = JSON.stringify(payload);
    let sent = 0;
    let removed = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: FOUR_HOURS,
          urgency: 'high',
        });
        sent++;
        await this.prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
          removed++;
        } else {
          this.logger.warn(`No se pudo enviar el push (${status ?? 'sin respuesta'}) a ${s.endpoint.slice(0, 60)}...`);
        }
      }
    }
    return { sent, removed };
  }

  /* ---------- Botones de la notificacion ---------- */

  /** Secreto distinto al del login: un token de accion no sirve como sesion. */
  private actionSecret(): string {
    return `${this.config.getOrThrow<string>('JWT_SECRET')}:push-actions`;
  }

  /** Token de un solo proposito (marcar ese habito ese dia, o esa tarea) que viaja dentro de la notificacion. */
  actionToken(userId: string, act: PushAction, targetId: string, date?: string): string {
    const claims: ActionClaims = { sub: userId, act, tid: targetId, typ: 'push-action', ...(date ? { d: date } : {}) };
    return this.jwt.sign(claims, { secret: this.actionSecret(), expiresIn: '36h' });
  }

  verifyActionToken(token: string): ActionClaims {
    try {
      const claims = this.jwt.verify<ActionClaims>(token, { secret: this.actionSecret() });
      if (claims.typ !== 'push-action') throw new Error('tipo');
      return claims;
    } catch {
      throw new UnauthorizedException('La acción venció o no es válida; abre la app para marcarlo.');
    }
  }
}
