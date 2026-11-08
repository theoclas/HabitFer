import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_DAILY_CAP, MAIL_PER_USER_DAILY_CAP, MailService, describeSmtpError, maskEmail } from './mail.service';

const content = { subject: 'Hola', text: 'texto', html: '<p>html</p>' };

function configWith(env: Record<string, string | number | boolean | undefined>) {
  return { get: (name: string) => env[name] } as unknown as ConfigService;
}

function withFakeTransport(service: MailService, sendMail: jest.Mock) {
  (service as unknown as { transport: unknown }).transport = { sendMail };
  return service;
}

const ON = { SMTP_USER: 'no-reply@fersuastudio.com', SMTP_PASS: 'clave' };

describe('MailService', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  it('sin usuario o sin clave queda apagado y no envia nada', async () => {
    expect(new MailService(configWith({})).enabled).toBe(false);
    expect(new MailService(configWith({ SMTP_USER: 'a@b.com', SMTP_PASS: '  ' })).enabled).toBe(false);
    const off = new MailService(configWith({ SMTP_PASS: 'x' }));
    await expect(off.send('u1', 'fer@gmail.com', content)).resolves.toEqual({ ok: false, reason: 'off' });
  });

  it('con usuario y clave queda listo; remitente y direccion de la app por defecto', () => {
    const service = new MailService(configWith(ON));
    expect(service.enabled).toBe(true);
    expect(service.from).toBe('HabitFer <no-reply@fersuastudio.com>');
    expect(service.appUrl).toBe('https://habitfer.fersuastudio.com');
  });

  it('respeta MAIL_FROM y APP_URL (sin la barra final)', () => {
    const service = new MailService(configWith({ ...ON, MAIL_FROM: 'Fer <x@y.com>', APP_URL: 'http://localhost:5173//' }));
    expect(service.from).toBe('Fer <x@y.com>');
    expect(service.appUrl).toBe('http://localhost:5173');
  });

  it('envia con el remitente configurado', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
    const service = withFakeTransport(new MailService(configWith(ON)), sendMail);
    await expect(service.send('u1', 'fer@gmail.com', content)).resolves.toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledWith({ from: 'HabitFer <no-reply@fersuastudio.com>', to: 'fer@gmail.com', ...content });
  });

  it('si el SMTP falla no lanza: devuelve el motivo en español', async () => {
    const sendMail = jest.fn().mockRejectedValue(Object.assign(new Error('Invalid login: 535'), { code: 'EAUTH', responseCode: 535 }));
    const service = withFakeTransport(new MailService(configWith(ON)), sendMail);
    await expect(service.send('u1', 'fer@gmail.com', content)).resolves.toEqual({
      ok: false,
      reason: 'error',
      detail: 'el servidor de correo rechazó el usuario o la clave',
    });
  });

  it('tope por usuario al dia', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const service = withFakeTransport(new MailService(configWith(ON)), sendMail);
    for (let i = 0; i < MAIL_PER_USER_DAILY_CAP; i++) await service.send('u1', 'a@b.com', content);
    await expect(service.send('u1', 'a@b.com', content)).resolves.toEqual({ ok: false, reason: 'cap' });
    // Otro usuario todavia puede.
    await expect(service.send('u2', 'c@d.com', content)).resolves.toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledTimes(MAIL_PER_USER_DAILY_CAP + 1);
  });

  it('tope global al dia', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const service = withFakeTransport(new MailService(configWith(ON)), sendMail);
    for (let i = 0; i < MAIL_DAILY_CAP; i++) await service.send(`u${i}`, 'a@b.com', content);
    await expect(service.send('otro', 'a@b.com', content)).resolves.toEqual({ ok: false, reason: 'cap' });
    expect(sendMail).toHaveBeenCalledTimes(MAIL_DAILY_CAP);
  });

  it('describeSmtpError y maskEmail', () => {
    expect(describeSmtpError({ code: 'ETIMEDOUT' })).toBe('no se pudo conectar con el servidor de correo');
    expect(describeSmtpError({ responseCode: 550 })).toBe('el servidor de correo lo rechazó (550)');
    expect(describeSmtpError({ code: 'EENVELOPE' })).toBe('la dirección de destino no es válida');
    expect(describeSmtpError(undefined)).toBe('el servidor de correo falló');
    expect(maskEmail('fernando@gmail.com')).toBe('fe***@gmail.com');
    expect(maskEmail('raro')).toBe('***');
  });
});
