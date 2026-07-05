import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FinanceAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinanceAccountDto, UpdateFinanceAccountDto } from './dto/account.dto';

@Injectable()
export class FernanceAccountsService {
  constructor(private prisma: PrismaService) {}

  async assertAccount(userId: string, accountId: string): Promise<FinanceAccount> {
    const account = await this.prisma.financeAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new ForbiddenException('Cuenta no encontrada');
    return account;
  }

  list(userId: string) {
    return this.prisma.financeAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: CreateFinanceAccountDto) {
    return this.prisma.financeAccount.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type,
        color: dto.color ?? '#D4AF37',
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateFinanceAccountDto) {
    await this.assertAccount(userId, id);
    return this.prisma.financeAccount.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        color: dto.color,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertAccount(userId, id);
    await this.prisma.financeAccount.delete({ where: { id } });
    return { ok: true };
  }

  async getOne(userId: string, id: string) {
    const account = await this.prisma.financeAccount.findFirst({ where: { id, userId } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    return account;
  }
}
