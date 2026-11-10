import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFinanceAccountDto,
  UpdateFinanceAccountDto,
} from './dto/account.dto';

export function serializeAccount(a: FinanceAccount) {
  return {
    id: a.id,
    userId: a.userId,
    name: a.name,
    type: a.type,
    currency: a.currency,
    color: a.color,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    archivedAt: a.archivedAt?.toISOString() ?? null,
  };
}

/**
 * Cuentas de FerFinance. Borrar una cuenta la archiva (papelera): deja de salir en listas y en el resumen
 * y se puede restaurar. Solo una cuenta archivada se puede borrar para siempre, con todo lo suyo.
 */
@Injectable()
export class FernanceAccountsService {
  constructor(private prisma: PrismaService) {}

  /** La cuenta, si es tuya (archivada o no). */
  async assertAccount(
    userId: string,
    accountId: string,
  ): Promise<FinanceAccount> {
    const account = await this.prisma.financeAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundException('No encontré esa cuenta.');
    return account;
  }

  /** La cuenta, si es tuya y no está archivada: para anotar algo nuevo en ella. */
  async assertActiveAccount(
    userId: string,
    accountId: string,
  ): Promise<FinanceAccount> {
    const account = await this.assertAccount(userId, accountId);
    if (account.archivedAt)
      throw new BadRequestException(
        `La cuenta «${account.name}» está archivada: restáurala para usarla.`,
      );
    return account;
  }

  async list(userId: string, includeArchived = false) {
    const rows = await this.prisma.financeAccount.findMany({
      where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(serializeAccount);
  }

  async create(userId: string, dto: CreateFinanceAccountDto) {
    const row = await this.prisma.financeAccount.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type,
        color: dto.color ?? '#D4AF37',
      },
    });
    return serializeAccount(row);
  }

  async update(userId: string, id: string, dto: UpdateFinanceAccountDto) {
    await this.assertAccount(userId, id);
    const row = await this.prisma.financeAccount.update({
      where: { id },
      data: { name: dto.name?.trim(), type: dto.type, color: dto.color },
    });
    return serializeAccount(row);
  }

  /** Mandar a la papelera. */
  async archive(userId: string, id: string) {
    const account = await this.assertAccount(userId, id);
    if (account.archivedAt) return serializeAccount(account);
    const row = await this.prisma.financeAccount.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return serializeAccount(row);
  }

  async restore(userId: string, id: string) {
    await this.assertAccount(userId, id);
    const row = await this.prisma.financeAccount.update({
      where: { id },
      data: { archivedAt: null },
    });
    return serializeAccount(row);
  }

  /** Borrar para siempre, con sus ingresos y créditos. Solo desde la papelera. */
  async purge(userId: string, id: string) {
    const account = await this.assertAccount(userId, id);
    if (!account.archivedAt)
      throw new BadRequestException(
        'Primero archiva la cuenta; desde la papelera se borra para siempre.',
      );
    await this.prisma.financeAccount.delete({ where: { id } });
    return { ok: true };
  }

  async getOne(userId: string, id: string) {
    return serializeAccount(await this.assertAccount(userId, id));
  }
}
