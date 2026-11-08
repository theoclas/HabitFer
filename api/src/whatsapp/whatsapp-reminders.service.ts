import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReminderLevel, UserRole, UserStatus } from '@prisma/client';
import { firstName } from '../mail/email-reminders.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActionLinksService } from '../push/action-links.service';
import type { MorningText } from '../reminders/morning.utils';
import { levelAllows, type ReminderKind } from '../reminders/reminder-level';
import { WaClient, type WaStatus } from './wa-client';
import {
  MAX_WHATSAPP_NUMBERS,
  coachText,
  formatPhone,
  habitText,
  maskPhone,
  morningText,
  normalizePhone,
  summaryText,
  taskText,
  testText,
} from './whatsapp-text';

/**
 * Topes diarios en memoria (envíos, no avisos: un aviso a 2 números cuenta 2). WhatsApp castiga las
 * ráfagas de los números nuevos, y esto es para 1 o 2 personas.
 */
export const WA_PER_USER_DAILY_CAP = 60;
export const WA_DAILY_CAP = 150;

const DEFAULT_APP_URL = 'https://habitfer.fersuastudio.com';

/**
 * Avisos por WhatsApp: decide a quién le toca (nivel y números del usuario) y los manda por el
 * celular vinculado. Los métodos de los recordatorios nunca lanzan: si WhatsApp falla, la ronda sigue.
 */
@Injectable()
export class WhatsappRemindersService {
  private readonly logger = new Logger(WhatsappRemindersService.name);
  private readonly appUrl: string;
  private day = '';
  private sentToday = 0;
  private readonly perUser = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private wa: WaClient,
    private links: ActionLinksService,
    config: ConfigService,
  ) {
    this.appUrl = (config.get<string>('APP_URL')?.trim() || DEFAULT_APP_URL).replace(/\/+$/, '');
  }

  /** Cuenta un envío si queda cupo hoy. */
  private take(userId: string): boolean {
    const today = new Date().toLocaleDateString('en-CA');
    if (today !== this.day) {
      this.day = today;
      this.sentToday = 0;
      this.perUser.clear();
    }
    const mine = this.perUser.get(userId) ?? 0;
    if (this.sentToday >= WA_DAILY_CAP || mine >= WA_PER_USER_DAILY_CAP) return false;
    this.sentToday++;
    this.perUser.set(userId, mine + 1);
    return true;
  }

  private async deliver(userId: string, kind: ReminderKind, build: () => Promise<string> | string): Promise<number> {
    if (!this.wa.enabled) return 0;
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true, whatsappReminders: true, whatsappNumbers: { select: { phone: true } } },
      });
      if (!user || user.status !== UserStatus.ACTIVE || !levelAllows(user.whatsappReminders, kind)) return 0;
      if (user.whatsappNumbers.length === 0) return 0;
      const text = await build();
      let sent = 0;
      for (const { phone } of user.whatsappNumbers) {
        if (!this.take(userId)) {
          this.logger.warn('WhatsApp omitido por el tope del día');
          break;
        }
        const result = await this.wa.send(phone, text);
        if (result.ok) sent++;
        else this.logger.warn(`WhatsApp a ${maskPhone(phone)} no salió: ${result.error}`);
      }
      return sent;
    } catch (err) {
      this.logger.warn(`No se pudo preparar el WhatsApp (${kind}): ${(err as Error).message}`);
      return 0;
    }
  }

  /** Enlace corto al botón «Hecho»; si no se puede crear, el aviso sale sin enlace. */
  private async shortLink(token: string, title: string, label: string): Promise<string | null> {
    try {
      return `${this.appUrl}/a/${await this.links.create(token, title, label)}`;
    } catch (err) {
      this.logger.warn(`Sin enlace corto: ${(err as Error).message}`);
      return null;
    }
  }

  habit(userId: string, p: { icon: string | null; title: string; body: string; token: string; actionLabel: string }) {
    return this.deliver(userId, 'reminder', async () =>
      habitText({ ...p, label: p.actionLabel, link: await this.shortLink(p.token, p.title, p.actionLabel) }),
    );
  }

  task(userId: string, p: { title: string; body: string; token: string }) {
    return this.deliver(userId, 'reminder', async () =>
      taskText({ ...p, link: await this.shortLink(p.token, p.title, 'Marcar como hecha') }),
    );
  }

  summary(userId: string, p: { title: string; body: string; items: string[] }) {
    return this.deliver(userId, 'digest', () => summaryText({ ...p, appUrl: this.appUrl }));
  }

  coach(userId: string, text: string) {
    return this.deliver(userId, 'digest', () => coachText({ text }));
  }

  /** Mensaje de la mañana (con el resumen y el coach: niveles SUMMARY y ALL). */
  morning(userId: string, m: MorningText) {
    return this.deliver(userId, 'digest', () => morningText({ ...m, appUrl: this.appUrl }));
  }

  /* ---------- Ajustes (Notificaciones…) ---------- */

  private senderView(s: WaStatus, withQr: boolean) {
    return {
      state: s.state,
      phone: s.me ? formatPhone(s.me) : null,
      error: s.error,
      ...(withQr ? { qr: s.qr } : {}),
    };
  }

  async settings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        habitSummaryTime: true,
        whatsappReminders: true,
        whatsappNumbers: { select: { id: true, phone: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      available: this.wa.enabled,
      sender: this.senderView(await this.wa.status(), false),
      level: user.whatsappReminders,
      numbers: user.whatsappNumbers.map((n) => ({ id: n.id, phone: formatPhone(n.phone) })),
      maxNumbers: MAX_WHATSAPP_NUMBERS,
      summaryTime: user.habitSummaryTime,
      isAdmin: user.role === UserRole.ADMIN,
    };
  }

  async update(userId: string, level: ReminderLevel) {
    await this.prisma.user.update({ where: { id: userId }, data: { whatsappReminders: level } });
    return this.settings(userId);
  }

  async addNumber(userId: string, input: string) {
    const phone = normalizePhone(input);
    if (!phone) throw new BadRequestException('Ese número no se ve bien. Escríbelo con el indicativo, por ejemplo +57 300 123 4567.');
    const numbers = await this.prisma.whatsappNumber.findMany({ where: { userId }, select: { phone: true } });
    if (numbers.some((n) => n.phone === phone)) throw new ConflictException('Ese número ya está.');
    if (numbers.length >= MAX_WHATSAPP_NUMBERS) {
      throw new BadRequestException(`Puedes tener hasta ${MAX_WHATSAPP_NUMBERS} números. Quita uno para agregar otro.`);
    }
    // Si el celular que envía está conectado, se revisa que el número tenga WhatsApp.
    if ((await this.wa.exists(phone)) === false) throw new BadRequestException('Ese número no tiene WhatsApp.');
    await this.prisma.whatsappNumber.create({ data: { userId, phone } });
    return this.settings(userId);
  }

  async removeNumber(userId: string, id: string) {
    const { count } = await this.prisma.whatsappNumber.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Número no encontrado');
    return this.settings(userId);
  }

  /** Mensaje de prueba a los números del usuario: aquí sí se dice por qué falla. */
  async test(userId: string) {
    if (!this.wa.enabled) throw new ServiceUnavailableException('WhatsApp todavía no está configurado en el servidor.');
    const sender = await this.wa.status();
    if (sender.state !== 'open') throw new ServiceUnavailableException('El celular que envía no está conectado.');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, username: true, whatsappNumbers: { select: { phone: true } } },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.whatsappNumbers.length === 0) throw new BadRequestException('Primero agrega tu número.');
    const text = testText({ name: firstName(user) });
    const errors: string[] = [];
    let sent = 0;
    for (const { phone } of user.whatsappNumbers) {
      if (!this.take(userId)) throw new HttpException('Hoy ya salieron muchos mensajes. Prueba mañana.', 429);
      const result = await this.wa.send(phone, text);
      if (result.ok) sent++;
      else errors.push(`${formatPhone(phone)}: ${result.error}`);
    }
    if (sent === 0) throw new HttpException(`No salió: ${errors.join(' · ')}`, 502);
    return { sent, total: user.whatsappNumbers.length, errors };
  }

  /* ---------- Celular que envía (solo admin) ---------- */

  async sender() {
    return this.senderView(await this.wa.status(), true);
  }

  async startSender() {
    return this.senderView(await this.wa.start(), true);
  }

  async logoutSender() {
    return this.senderView(await this.wa.logout(), true);
  }
}
