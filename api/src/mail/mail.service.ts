import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { startOfToday, toDateKey } from '../common/date.utils';
import type { MailContent } from './mail-templates';

/** Lo poco que se usa del transporte de nodemailer (en las pruebas se reemplaza). */
export interface MailTransport {
  sendMail(msg: { from: string; to: string; subject: string; text: string; html: string }): Promise<unknown>;
}

export type SendResult = { ok: true } | { ok: false; reason: 'off' | 'cap' | 'error'; detail?: string };

/**
 * Topes diarios en memoria. El buzon es el mismo del booking (no-reply@fersuastudio.com) y
 * Hostinger le da un cupo de envios al dia: HabitFer nunca debe gastarselo.
 */
export const MAIL_DAILY_CAP = 150;
export const MAIL_PER_USER_DAILY_CAP = 40;

const DEFAULT_APP_URL = 'https://habitfer.fersuastudio.com';

/** Texto corto y en español para los errores tipicos del SMTP (sin datos de la cuenta). */
export function describeSmtpError(err: unknown): string {
  const e = (err ?? {}) as { code?: string; responseCode?: number };
  if (e.code === 'EAUTH' || e.responseCode === 535) return 'el servidor de correo rechazó el usuario o la clave';
  if (e.code && ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'EDNS'].includes(e.code)) {
    return 'no se pudo conectar con el servidor de correo';
  }
  if (e.code === 'EENVELOPE') return 'la dirección de destino no es válida';
  if (e.responseCode && e.responseCode >= 500) return `el servidor de correo lo rechazó (${e.responseCode})`;
  return 'el servidor de correo falló';
}

/** "fe***@gmail.com": para los registros, sin dejar el correo completo. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}***@${domain}`;
}

/**
 * Envio de correos por SMTP (Hostinger: smtp.hostinger.com:465 con SSL). Sin SMTP_USER y
 * SMTP_PASS queda apagado y la app sigue igual, solo con push.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transport: MailTransport | null;
  readonly from: string;
  /** Direccion publica de la app para los enlaces (sin "/" al final). */
  readonly appUrl: string;
  private day = '';
  private sentToday = 0;
  private readonly perUser = new Map<string, number>();

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER')?.trim() ?? '';
    const pass = config.get<string>('SMTP_PASS') ?? '';
    const host = config.get<string>('SMTP_HOST')?.trim() || 'smtp.hostinger.com';
    const port = Number(config.get<number | string>('SMTP_PORT')) || 465;
    const secureRaw = config.get<boolean | string>('SMTP_SECURE');
    const secure = secureRaw === undefined || secureRaw === '' ? port === 465 : String(secureRaw) !== 'false';
    this.from = config.get<string>('MAIL_FROM')?.trim() || (user ? `HabitFer <${user}>` : 'HabitFer');
    this.appUrl = (config.get<string>('APP_URL')?.trim() || DEFAULT_APP_URL).replace(/\/+$/, '');

    if (!user || !pass.trim()) {
      this.transport = null;
      this.logger.log('Avisos por correo apagados: faltan SMTP_USER y SMTP_PASS');
      return;
    }
    this.transport = createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    }) as unknown as MailTransport;
    this.logger.log(`Avisos por correo listos: ${host}:${port} como ${user}`);
  }

  get enabled(): boolean {
    return this.transport !== null;
  }

  /** Envia un correo. Nunca lanza: devuelve si salio y, si no, por que. */
  async send(userId: string, to: string, content: MailContent): Promise<SendResult> {
    if (!this.transport) return { ok: false, reason: 'off' };
    this.rollDay();
    const mine = this.perUser.get(userId) ?? 0;
    if (this.sentToday >= MAIL_DAILY_CAP || mine >= MAIL_PER_USER_DAILY_CAP) {
      this.logger.warn(`Correo omitido por el tope del día (${this.sentToday} en total, ${mine} de este usuario)`);
      return { ok: false, reason: 'cap' };
    }
    // Se cuenta antes de enviar: dos envios a la vez no se saltan el tope.
    this.sentToday++;
    this.perUser.set(userId, mine + 1);
    try {
      await this.transport.sendMail({ from: this.from, to, subject: content.subject, text: content.text, html: content.html });
      return { ok: true };
    } catch (err) {
      const detail = describeSmtpError(err);
      const raw = (err as { message?: string })?.message ?? '';
      this.logger.warn(`No se pudo enviar el correo a ${maskEmail(to)}: ${detail} (${raw.slice(0, 160)})`);
      return { ok: false, reason: 'error', detail };
    }
  }

  /** Los topes se reinician cada dia (hora local del servidor). */
  private rollDay() {
    const today = toDateKey(startOfToday());
    if (today !== this.day) {
      this.day = today;
      this.sentToday = 0;
      this.perUser.clear();
    }
  }
}
