import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

function makeService(secret = 'secreto-de-prueba-123') {
  const config = new ConfigService({ JWT_SECRET: secret });
  const jwt = new JwtService({ secret, signOptions: { expiresIn: '8h' } });
  return { service: new PushService({} as PrismaService, jwt, config), jwt };
}

describe('PushService (tokens de accion)', () => {
  it('firma y verifica la accion de marcar un habito', () => {
    const { service } = makeService();
    const token = service.actionToken('u1', 'habit-done', 'h1', '2026-11-07');
    expect(service.verifyActionToken(token)).toMatchObject({ sub: 'u1', act: 'habit-done', tid: 'h1', d: '2026-11-07' });
  });

  it('un token de accion no sirve como sesion (otro secreto)', () => {
    const { service, jwt } = makeService();
    const token = service.actionToken('u1', 'task-done', 't1');
    expect(() => jwt.verify(token)).toThrow();
  });

  it('rechaza tokens de sesion y tokens alterados', () => {
    const { service, jwt } = makeService();
    const session = jwt.sign({ sub: 'u1' });
    expect(() => service.verifyActionToken(session)).toThrow(UnauthorizedException);
    const token = service.actionToken('u1', 'habit-done', 'h1', '2026-11-07');
    expect(() => service.verifyActionToken(token.slice(0, -2) + 'xx')).toThrow(UnauthorizedException);
  });

  it('sin llaves VAPID el push queda apagado y no falla', async () => {
    // ConfigService lee primero process.env, y Prisma carga api/.env al importarse:
    // se quitan las llaves locales mientras corre la prueba para no depender del equipo.
    const saved = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    try {
      const { service } = makeService();
      service.onModuleInit();
      expect(service.enabled).toBe(false);
      await expect(service.sendToUser('u1', { title: 't', body: 'b' })).resolves.toEqual({ sent: 0, removed: 0 });
    } finally {
      if (saved.pub !== undefined) process.env.VAPID_PUBLIC_KEY = saved.pub;
      if (saved.priv !== undefined) process.env.VAPID_PRIVATE_KEY = saved.priv;
    }
  });
});
