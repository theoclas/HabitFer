import { Prisma } from '@prisma/client';
import { ActionLinksService, CODE_RE, randomCode } from './action-links.service';

function setup() {
  const prisma = {
    actionLink: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
  };
  return { service: new ActionLinksService(prisma as never), prisma };
}

describe('ActionLinksService', () => {
  it('códigos de 9 caracteres sin letras que se confunden', () => {
    for (let i = 0; i < 200; i++) {
      const code = randomCode();
      expect(code).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{9}$/);
      expect(CODE_RE.test(code)).toBe(true);
    }
  });

  it('crea el enlace con el token y vence en 36 horas', async () => {
    const { service, prisma } = setup();
    const before = Date.now();
    const code = await service.create('tok', 'Leer', 'Marcar como hecho');
    expect(prisma.actionLink.deleteMany).toHaveBeenCalled();
    const data = prisma.actionLink.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ code, token: 'tok', title: 'Leer', label: 'Marcar como hecho' });
    const ttl = data.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(36 * 3600 * 1000 - 1000);
    expect(ttl).toBeLessThanOrEqual(36 * 3600 * 1000 + 1000);
  });

  it('si el código ya existe prueba con otro', async () => {
    const { service, prisma } = setup();
    prisma.actionLink.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('repetido', { code: 'P2002', clientVersion: 'x' }),
    );
    await service.create('tok', 'Leer', 'Hecho');
    expect(prisma.actionLink.create).toHaveBeenCalledTimes(2);
  });

  it('resolver: código raro, inexistente o vencido → null', async () => {
    const { service, prisma } = setup();
    await expect(service.resolve('../../etc')).resolves.toBeNull();
    expect(prisma.actionLink.findUnique).not.toHaveBeenCalled();
    prisma.actionLink.findUnique.mockResolvedValueOnce(null);
    await expect(service.resolve('Abc123xyz')).resolves.toBeNull();
    prisma.actionLink.findUnique.mockResolvedValueOnce({ token: 't', title: 'n', label: 'l', expiresAt: new Date(Date.now() - 1000) });
    await expect(service.resolve('Abc123xyz')).resolves.toBeNull();
    prisma.actionLink.findUnique.mockResolvedValueOnce({ token: 't', title: 'n', label: 'l', expiresAt: new Date(Date.now() + 60_000) });
    await expect(service.resolve('Abc123xyz')).resolves.toEqual({ t: 't', n: 'n', l: 'l' });
  });
});
