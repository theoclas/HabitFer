import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreditStatus, InstallmentStatus } from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCreditDto, UpdateCreditDto } from './dto/credit.dto';
import { decimalToNumber, generateInstallmentDrafts } from './fernance.utils';
import { FernanceAccountsService } from './fernance-accounts.service';

function serializeInstallment(row: {
  id: string;
  creditId: string;
  dueDate: Date;
  amount: { toString(): string };
  status: InstallmentStatus;
  paidAt: Date | null;
}) {
  return {
    id: row.id,
    creditId: row.creditId,
    dueDate: toDateKey(row.dueDate),
    amount: decimalToNumber(row.amount),
    status: row.status,
    paidAt: row.paidAt?.toISOString() ?? null,
  };
}

function serializeCredit(row: {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  totalAmount: { toString(): string };
  installmentAmount: { toString(): string };
  status: CreditStatus;
  createdAt: Date;
  updatedAt: Date;
  account?: { id: string; name: string; color: string | null };
  installments?: {
    id: string;
    creditId: string;
    dueDate: Date;
    amount: { toString(): string };
    status: InstallmentStatus;
    paidAt: Date | null;
  }[];
}) {
  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    name: row.name,
    totalAmount: decimalToNumber(row.totalAmount),
    installmentAmount: decimalToNumber(row.installmentAmount),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    account: row.account,
    installments: row.installments?.map(serializeInstallment),
  };
}

@Injectable()
export class FernanceCreditsService {
  constructor(
    private prisma: PrismaService,
    private accounts: FernanceAccountsService,
  ) {}

  async list(userId: string, accountId?: string, status?: CreditStatus) {
    const where: { userId: string; accountId?: string; status?: CreditStatus } = { userId };
    if (accountId) {
      await this.accounts.assertAccount(userId, accountId);
      where.accountId = accountId;
    }
    if (status) where.status = status;
    const rows = await this.prisma.credit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        account: { select: { id: true, name: true, color: true } },
        installments: { orderBy: { dueDate: 'asc' } },
      },
    });
    return rows.map(serializeCredit);
  }

  async getOne(userId: string, id: string) {
    const row = await this.prisma.credit.findFirst({
      where: { id, userId },
      include: {
        account: { select: { id: true, name: true, color: true } },
        installments: { orderBy: { dueDate: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Credito no encontrado');
    return serializeCredit(row);
  }

  async create(userId: string, dto: CreateCreditDto) {
    await this.accounts.assertAccount(userId, dto.accountId);
    if (dto.installmentAmount > dto.totalAmount) {
      throw new BadRequestException('La cuota no puede ser mayor al total');
    }
    const drafts = generateInstallmentDrafts(
      dto.totalAmount,
      dto.installmentAmount,
      parseDateKey(dto.firstDueDate),
    );
    const row = await this.prisma.credit.create({
      data: {
        userId,
        accountId: dto.accountId,
        name: dto.name.trim(),
        totalAmount: dto.totalAmount,
        installmentAmount: dto.installmentAmount,
        installments: {
          create: drafts.map((d) => ({
            dueDate: d.dueDate,
            amount: d.amount,
          })),
        },
      },
      include: {
        account: { select: { id: true, name: true, color: true } },
        installments: { orderBy: { dueDate: 'asc' } },
      },
    });
    return serializeCredit(row);
  }

  async update(userId: string, id: string, dto: UpdateCreditDto) {
    const existing = await this.prisma.credit.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Credito no encontrado');
    const row = await this.prisma.credit.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        status: dto.status,
      },
      include: {
        account: { select: { id: true, name: true, color: true } },
        installments: { orderBy: { dueDate: 'asc' } },
      },
    });
    return serializeCredit(row);
  }

  private async assertInstallment(userId: string, installmentId: string) {
    const inst = await this.prisma.creditInstallment.findFirst({
      where: { id: installmentId, credit: { userId } },
      include: { credit: true },
    });
    if (!inst) throw new NotFoundException('Cuota no encontrada');
    return inst;
  }

  async payInstallment(userId: string, installmentId: string) {
    const inst = await this.assertInstallment(userId, installmentId);
    if (inst.status === InstallmentStatus.PAID) return serializeInstallment(inst);
    const updated = await this.prisma.creditInstallment.update({
      where: { id: installmentId },
      data: { status: InstallmentStatus.PAID, paidAt: new Date() },
    });
    const pending = await this.prisma.creditInstallment.count({
      where: { creditId: inst.creditId, status: InstallmentStatus.PENDING },
    });
    if (pending === 0) {
      await this.prisma.credit.update({
        where: { id: inst.creditId },
        data: { status: CreditStatus.PAID_OFF },
      });
    }
    return serializeInstallment(updated);
  }

  async unpayInstallment(userId: string, installmentId: string) {
    const inst = await this.assertInstallment(userId, installmentId);
    const updated = await this.prisma.creditInstallment.update({
      where: { id: installmentId },
      data: { status: InstallmentStatus.PENDING, paidAt: null },
    });
    await this.prisma.credit.update({
      where: { id: inst.creditId },
      data: { status: CreditStatus.ACTIVE },
    });
    return serializeInstallment(updated);
  }
}
