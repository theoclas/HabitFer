import { BadGatewayException, HttpException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EmailReminders, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  actionLink,
  coachMail,
  habitReminderMail,
  summaryMail,
  taskReminderMail,
  testMail,
  type MailContent,
} from './mail-templates';
import { MailService } from './mail.service';

/** reminder: cada aviso de habitos y tareas (solo con ALL). digest: resumen de la noche y coach (SUMMARY o ALL). */
type Kind = 'reminder' | 'digest';

export function wantsEmail(level: EmailReminders, kind: Kind): boolean {
  if (kind === 'digest') return level !== EmailReminders.OFF;
  return level === EmailReminders.ALL;
}

function firstName(u: { fullName: string | null; username: string }): string {
  return (u.fullName?.trim().split(/\s+/)[0] || u.username || '').slice(0, 40);
}

/**
 * Avisos por correo: decide si a este usuario le toca (segun su nivel) y arma el correo.
 * Los metodos de los recordatorios nunca lanzan: un correo que falla no frena la ronda.
 */
@Injectable()
export class EmailRemindersService {
  private readonly logger = new Logger(EmailRemindersService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  get enabled(): boolean {
    return this.mail.enabled;
  }

  private async deliver(userId: string, kind: Kind, build: (appUrl: string) => MailContent): Promise<boolean> {
    if (!this.mail.enabled) return false;
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, status: true, emailReminders: true },
      });
      if (!user || user.status !== UserStatus.ACTIVE || !wantsEmail(user.emailReminders, kind)) return false;
      const result = await this.mail.send(userId, user.email, build(this.mail.appUrl));
      return result.ok;
    } catch (err) {
      this.logger.warn(`No se pudo preparar el correo (${kind}): ${(err as Error).message}`);
      return false;
    }
  }

  /** Aviso de un habito; el boton marca hecho (o suma, en los medibles) con el token del aviso. */
  habit(userId: string, p: { icon: string | null; title: string; body: string; token: string; actionLabel: string }) {
    return this.deliver(userId, 'reminder', (appUrl) =>
      habitReminderMail({
        appUrl,
        icon: p.icon,
        title: p.title,
        body: p.body,
        actionLabel: p.actionLabel,
        actionUrl: actionLink(appUrl, p.token, p.title, p.actionLabel),
      }),
    );
  }

  task(userId: string, p: { title: string; body: string; token: string }) {
    return this.deliver(userId, 'reminder', (appUrl) =>
      taskReminderMail({
        appUrl,
        title: p.title,
        body: p.body,
        actionUrl: actionLink(appUrl, p.token, p.title, 'Marcar como hecha'),
      }),
    );
  }

  summary(userId: string, p: { title: string; body: string; items: string[] }) {
    return this.deliver(userId, 'digest', (appUrl) => summaryMail({ appUrl, ...p }));
  }

  coach(userId: string, text: string) {
    return this.deliver(userId, 'digest', (appUrl) => coachMail({ appUrl, text }));
  }

  /* ---------- Ajustes (Notificaciones…) ---------- */

  async settings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailReminders: true, habitSummaryTime: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      enabled: this.mail.enabled,
      address: user.email,
      level: user.emailReminders,
      summaryTime: user.habitSummaryTime,
    };
  }

  async update(userId: string, level: EmailReminders) {
    await this.prisma.user.update({ where: { id: userId }, data: { emailReminders: level } });
    return this.settings(userId);
  }

  /** Correo de prueba: aqui si se avisa por que fallo, para que se pueda arreglar. */
  async test(userId: string) {
    if (!this.mail.enabled) throw new ServiceUnavailableException('El correo todavía no está configurado en el servidor.');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true, username: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const result = await this.mail.send(userId, user.email, testMail({ appUrl: this.mail.appUrl, name: firstName(user) }));
    if (result.ok) return { ok: true, address: user.email };
    if (result.reason === 'cap') throw new HttpException('Hoy ya salieron muchos correos. Prueba mañana.', 429);
    throw new BadGatewayException(`No se pudo enviar: ${result.detail ?? 'falló el servidor de correo'}.`);
  }
}
