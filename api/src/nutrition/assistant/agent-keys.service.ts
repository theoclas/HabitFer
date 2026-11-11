import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { NutritionAgentKey } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  bearerToken,
  cleanKeyName,
  hashAgentKey,
  MAX_AGENT_KEYS,
  newAgentKey,
} from './agent-keys';

/** Anotar el último uso como mucho una vez por minuto (no escribir en cada consulta). */
const TOUCH_EVERY_MS = 60_000;

const view = (k: NutritionAgentKey) => ({
  id: k.id,
  name: k.name,
  hint: k.hint,
  createdAt: k.createdAt.toISOString(),
  lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
});

/** Llaves para que un asistente (Claude) lea el informe de NutriFer. Solo sirven para leer. */
@Injectable()
export class AgentKeysService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.nutritionAgentKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(view);
  }

  /** Llave nueva: se muestra esta vez y nunca más (se guarda su huella). */
  async create(userId: string, name?: string) {
    const count = await this.prisma.nutritionAgentKey.count({
      where: { userId },
    });
    if (count >= MAX_AGENT_KEYS)
      throw new BadRequestException(
        `Ya tienes ${MAX_AGENT_KEYS} llaves: quita una antes de crear otra.`,
      );
    const k = newAgentKey();
    const row = await this.prisma.nutritionAgentKey.create({
      data: {
        userId,
        name: cleanKeyName(name),
        tokenHash: k.tokenHash,
        hint: k.hint,
      },
    });
    return { token: k.token, key: view(row) };
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.nutritionAgentKey.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Esa llave ya no existe.');
    return { removed: count };
  }

  /** De quién es la llave del encabezado `Authorization: Bearer …` (o 401). */
  async resolve(authorization: string | undefined): Promise<string> {
    const token = bearerToken(authorization);
    const row = token
      ? await this.prisma.nutritionAgentKey.findUnique({
          where: { tokenHash: hashAgentKey(token) },
        })
      : null;
    if (!row)
      throw new UnauthorizedException(
        'Esa llave no sirve. Crea una en NutriFer › Meta › Claude.',
      );
    if (
      !row.lastUsedAt ||
      Date.now() - row.lastUsedAt.getTime() > TOUCH_EVERY_MS
    ) {
      // Si falla, la consulta sigue: solo es la fecha de «la usó por última vez».
      await this.prisma.nutritionAgentKey
        .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }
    return row.userId;
  }
}
