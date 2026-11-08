import { Logger } from '@nestjs/common';
import { EmailReminders, UserStatus } from '@prisma/client';
import { EmailRemindersService, wantsEmail } from './email-reminders.service';
import type { MailService, SendResult } from './mail.service';

type User = { email: string; status: UserStatus; emailReminders: EmailReminders; fullName?: string; username?: string };

function setup(user: User | null, opts: { enabled?: boolean; result?: SendResult } = {}) {
  const findUnique = jest.fn().mockResolvedValue(user);
  const send = jest.fn().mockResolvedValue(opts.result ?? { ok: true });
  const mail = { enabled: opts.enabled ?? true, appUrl: 'https://habitfer.fersuastudio.com', send } as unknown as MailService;
  const prisma = { user: { findUnique } };
  return { service: new EmailRemindersService(prisma as never, mail), send, findUnique };
}

const user = (level: EmailReminders, status: UserStatus = UserStatus.ACTIVE): User => ({
  email: 'fer@gmail.com',
  status,
  emailReminders: level,
  fullName: 'Fernando Suárez',
  username: 'fer',
});

const habit = { icon: '📚', title: 'Leer', body: 'Es hora de tu hábito.', token: 'tok', actionLabel: 'Marcar como hecho' };

describe('EmailRemindersService', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());

  it('wantsEmail: OFF nada, SUMMARY solo resumen y coach, ALL todo', () => {
    expect(wantsEmail(EmailReminders.OFF, 'reminder')).toBe(false);
    expect(wantsEmail(EmailReminders.OFF, 'digest')).toBe(false);
    expect(wantsEmail(EmailReminders.SUMMARY, 'reminder')).toBe(false);
    expect(wantsEmail(EmailReminders.SUMMARY, 'digest')).toBe(true);
    expect(wantsEmail(EmailReminders.ALL, 'reminder')).toBe(true);
    expect(wantsEmail(EmailReminders.ALL, 'digest')).toBe(true);
  });

  it('con ALL manda el aviso del habito con el enlace de accion', async () => {
    const { service, send } = setup(user(EmailReminders.ALL));
    await expect(service.habit('u1', habit)).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const [userId, to, content] = send.mock.calls[0];
    expect(userId).toBe('u1');
    expect(to).toBe('fer@gmail.com');
    expect(content.subject).toBe('📚 Leer');
    expect(content.text).toContain('https://habitfer.fersuastudio.com/accion#t=tok');
  });

  it('con SUMMARY no manda avisos de habitos ni tareas, pero si el resumen y el coach', async () => {
    const { service, send } = setup(user(EmailReminders.SUMMARY));
    await expect(service.habit('u1', habit)).resolves.toBe(false);
    await expect(service.task('u1', { title: 'Llamar', body: 'b', token: 't' })).resolves.toBe(false);
    await expect(service.summary('u1', { title: 'T', body: 'B', items: ['Leer'] })).resolves.toBe(true);
    await expect(service.coach('u1', 'Hola.')).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('con OFF o usuario inactivo no manda nada', async () => {
    const off = setup(user(EmailReminders.OFF));
    await expect(off.service.summary('u1', { title: 'T', body: 'B', items: [] })).resolves.toBe(false);
    const inactive = setup(user(EmailReminders.ALL, UserStatus.PENDING));
    await expect(inactive.service.habit('u1', habit)).resolves.toBe(false);
    expect(off.send).not.toHaveBeenCalled();
    expect(inactive.send).not.toHaveBeenCalled();
  });

  it('sin correo configurado ni siquiera consulta la base', async () => {
    const { service, findUnique, send } = setup(user(EmailReminders.ALL), { enabled: false });
    await expect(service.habit('u1', habit)).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('si la base falla no lanza (la ronda de recordatorios sigue)', async () => {
    const { service, findUnique } = setup(null);
    findUnique.mockRejectedValueOnce(new Error('sin conexion'));
    await expect(service.habit('u1', habit)).resolves.toBe(false);
  });

  it('correo de prueba: 503 sin configurar, 429 con el tope, 502 con el motivo', async () => {
    await expect(setup(user(EmailReminders.OFF), { enabled: false }).service.test('u1')).rejects.toMatchObject({ status: 503 });
    await expect(setup(user(EmailReminders.OFF), { result: { ok: false, reason: 'cap' } }).service.test('u1')).rejects.toMatchObject({ status: 429 });
    const failing = setup(user(EmailReminders.OFF), { result: { ok: false, reason: 'error', detail: 'el servidor de correo rechazó el usuario o la clave' } });
    await expect(failing.service.test('u1')).rejects.toMatchObject({
      status: 502,
      message: 'No se pudo enviar: el servidor de correo rechazó el usuario o la clave.',
    });
  });

  it('correo de prueba: sale aunque el nivel este en OFF y saluda por el nombre', async () => {
    const { service, send } = setup(user(EmailReminders.OFF));
    await expect(service.test('u1')).resolves.toEqual({ ok: true, address: 'fer@gmail.com' });
    expect(send.mock.calls[0][2].html).toContain('¡Hola, Fernando!');
  });
});
