import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Sin letras que se confunden (0/O, 1/l/I). */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 9;
/** Lo mismo que dura el token de acción. */
const TTL_MS = 36 * 60 * 60 * 1000;

export function randomCode(length = CODE_LENGTH): string {
  return Array.from(randomBytes(length), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const CODE_RE = /^[A-Za-z0-9]{6,16}$/;

/**
 * Enlaces cortos del botón «Hecho» de WhatsApp: /a/<código> en vez de un token de 300 caracteres.
 * La web pide el token con el código y abre la misma página /accion de los correos.
 */
@Injectable()
export class ActionLinksService {
  constructor(private prisma: PrismaService) {}

  async create(token: string, title: string, label: string): Promise<string> {
    // De paso se borran los vencidos (hay índice por expiresAt).
    await this.prisma.actionLink.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const expiresAt = new Date(Date.now() + TTL_MS);
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = randomCode();
      try {
        await this.prisma.actionLink.create({
          data: { code, token, title: title.slice(0, 120), label: label.slice(0, 60), expiresAt },
        });
        return code;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
    }
    throw new Error('No se pudo crear el enlace corto');
  }

  /** { t, n, l } como el fragmento de /accion; null si no existe o ya venció. */
  async resolve(code: string): Promise<{ t: string; n: string; l: string } | null> {
    if (!CODE_RE.test(code)) return null;
    const link = await this.prisma.actionLink.findUnique({ where: { code } });
    if (!link || link.expiresAt.getTime() <= Date.now()) return null;
    return { t: link.token, n: link.title, l: link.label };
  }
}
