import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReminderLevel, UserRole, UserStatus } from '@prisma/client';
import type { ActionLinksService } from '../push/action-links.service';
import type { WaClient, WaStatus } from './wa-client';
import { WA_PER_USER_DAILY_CAP, WhatsappRemindersService } from './whatsapp-reminders.service';

type User = {
  status: UserStatus;
  role?: UserRole;
  fullName?: string;
  username?: string;
  habitSummaryTime?: string | null;
  whatsappReminders: ReminderLevel;
  whatsappNumbers: { id?: string; phone: string }[];
};

const OPEN: WaStatus = { state: 'open', me: '573111111111', qr: null, error: null };

function setup(user: User | null, opts: { enabled?: boolean; status?: WaStatus; send?: jest.Mock; exists?: boolean | null } = {}) {
  const send = opts.send ?? jest.fn().mockResolvedValue({ ok: true });
  const wa = {
    enabled: opts.enabled ?? true,
    send,
    status: jest.fn().mockResolvedValue(opts.status ?? OPEN),
    exists: jest.fn().mockResolvedValue(opts.exists ?? true),
  } as unknown as WaClient;
  const links = { create: jest.fn().mockResolvedValue('Abc123xyz') } as unknown as ActionLinksService;
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn().mockResolvedValue({}) },
    whatsappNumber: {
      findMany: jest.fn().mockResolvedValue(user?.whatsappNumbers ?? []),
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const config = { get: (k: string) => (k === 'APP_URL' ? 'https://habitfer.test' : undefined) } as unknown as ConfigService;
  return { service: new WhatsappRemindersService(prisma as never, wa, links, config), send, prisma, wa, links };
}

const user = (level: ReminderLevel, phones = ['573001234567']): User => ({
  status: UserStatus.ACTIVE,
  role: UserRole.ADMIN,
  fullName: 'Fernando Suárez',
  username: 'fer',
  habitSummaryTime: '21:00',
  whatsappReminders: level,
  whatsappNumbers: phones.map((phone, i) => ({ id: `n${i}`, phone })),
});

const habit = { icon: '📚', title: 'Leer', body: 'Es hora de tu hábito.', token: 'tok', actionLabel: 'Marcar como hecho' };

describe('WhatsappRemindersService', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());

  it('con ALL manda el aviso a cada número, con el enlace corto', async () => {
    const { service, send, links } = setup(user(ReminderLevel.ALL, ['573001234567', '573109876543']));
    await expect(service.habit('u1', habit)).resolves.toBe(2);
    expect(links.create).toHaveBeenCalledWith('tok', 'Leer', 'Marcar como hecho');
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toBe('573001234567');
    expect(send.mock.calls[1][0]).toBe('573109876543');
    expect(send.mock.calls[0][1]).toBe('📚 *Leer*\nEs hora de tu hábito.\n\n✓ Marcar como hecho: https://habitfer.test/a/Abc123xyz');
  });

  it('con SUMMARY solo el resumen y el coach', async () => {
    const { service, send, links } = setup(user(ReminderLevel.SUMMARY));
    await expect(service.habit('u1', habit)).resolves.toBe(0);
    await expect(service.task('u1', { title: 'Llamar', body: 'b', token: 't' })).resolves.toBe(0);
    expect(links.create).not.toHaveBeenCalled();
    await expect(service.summary('u1', { title: 'T', body: 'B', items: ['Leer'] })).resolves.toBe(1);
    await expect(service.coach('u1', 'Hola.')).resolves.toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('OFF, sin números, inactivo o sin servicio: no manda nada', async () => {
    for (const s of [
      setup(user(ReminderLevel.OFF)),
      setup(user(ReminderLevel.ALL, [])),
      setup({ ...user(ReminderLevel.ALL), status: UserStatus.SUSPENDED }),
      setup(user(ReminderLevel.ALL), { enabled: false }),
    ]) {
      await expect(s.service.habit('u1', habit)).resolves.toBe(0);
      expect(s.send).not.toHaveBeenCalled();
    }
  });

  it('si WhatsApp falla no lanza (la ronda sigue)', async () => {
    const send = jest.fn().mockResolvedValue({ ok: false, error: 'El celular que envía no está conectado.' });
    const { service } = setup(user(ReminderLevel.ALL), { send });
    await expect(service.habit('u1', habit)).resolves.toBe(0);
    const broken = setup(user(ReminderLevel.ALL));
    (broken.prisma.user.findUnique as jest.Mock).mockRejectedValueOnce(new Error('sin base'));
    await expect(broken.service.habit('u1', habit)).resolves.toBe(0);
  });

  it('tope diario por usuario', async () => {
    const { service, send } = setup(user(ReminderLevel.ALL));
    for (let i = 0; i < WA_PER_USER_DAILY_CAP; i++) await service.coach('u1', `m${i}`);
    await expect(service.coach('u1', 'una más')).resolves.toBe(0);
    expect(send).toHaveBeenCalledTimes(WA_PER_USER_DAILY_CAP);
  });

  it('agregar números: valida, no repite, máximo 2 y revisa que tenga WhatsApp', async () => {
    await expect(setup(user(ReminderLevel.OFF, [])).service.addNumber('u1', 'hola')).rejects.toMatchObject({ status: 400 });
    await expect(setup(user(ReminderLevel.OFF)).service.addNumber('u1', '300 123 4567')).rejects.toMatchObject({ status: 409 });
    await expect(
      setup(user(ReminderLevel.OFF, ['573001111111', '573002222222'])).service.addNumber('u1', '3003333333'),
    ).rejects.toMatchObject({ status: 400, message: 'Puedes tener hasta 2 números. Quita uno para agregar otro.' });
    await expect(setup(user(ReminderLevel.OFF, []), { exists: false }).service.addNumber('u1', '3003333333')).rejects.toMatchObject({
      status: 400,
      message: 'Ese número no tiene WhatsApp.',
    });
    // Sin poder revisar (celular sin conectar) se acepta igual.
    const ok = setup(user(ReminderLevel.OFF, []), { exists: null });
    await ok.service.addNumber('u1', '+57 300 333 3333');
    expect(ok.prisma.whatsappNumber.create).toHaveBeenCalledWith({ data: { userId: 'u1', phone: '573003333333' } });
  });

  it('ajustes: números con formato, estado del celular sin el QR y si es admin', async () => {
    const { service } = setup(user(ReminderLevel.SUMMARY), { status: { state: 'qr', me: null, qr: 'data:image/png;base64,xx', error: null } });
    const s = await service.settings('u1');
    expect(s).toMatchObject({
      available: true,
      level: 'SUMMARY',
      numbers: [{ id: 'n0', phone: '+57 300 123 4567' }],
      maxNumbers: 2,
      isAdmin: true,
      sender: { state: 'qr', phone: null },
    });
    expect('qr' in s.sender).toBe(false);
    await expect(service.sender()).resolves.toMatchObject({ state: 'qr', qr: 'data:image/png;base64,xx' });
  });

  it('mensaje de prueba: explica por qué no sale', async () => {
    await expect(setup(user(ReminderLevel.OFF), { enabled: false }).service.test('u1')).rejects.toMatchObject({ status: 503 });
    await expect(
      setup(user(ReminderLevel.OFF), { status: { state: 'qr', me: null, qr: null, error: null } }).service.test('u1'),
    ).rejects.toMatchObject({ status: 503, message: 'El celular que envía no está conectado.' });
    await expect(setup(user(ReminderLevel.OFF, [])).service.test('u1')).rejects.toMatchObject({ status: 400 });
    const send = jest.fn().mockResolvedValue({ ok: false, error: 'Ese número no tiene WhatsApp.' });
    await expect(setup(user(ReminderLevel.OFF), { send }).service.test('u1')).rejects.toMatchObject({ status: 502 });
    const good = setup(user(ReminderLevel.OFF));
    await expect(good.service.test('u1')).resolves.toEqual({ sent: 1, total: 1, errors: [] });
    expect(good.send.mock.calls[0][1]).toContain('¡Hola, Fernando!');
  });
});
