import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreditStatus, InstallmentStatus, type Prisma } from '@prisma/client';
import { localTodayKey, parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCreditDto,
  PayInstallmentDto,
  ReplanCreditDto,
  UpdateCreditDto,
  UpdateInstallmentDto,
} from './dto/credit.dto';
import {
  daysBetween,
  decimalToNumber,
  generateInstallmentDrafts,
  planDrafts,
  roundMoney,
  roundPesos,
  toLocalDateKey,
} from './fernance.utils';
import { FernanceAccountsService } from './fernance-accounts.service';

type Tx = Prisma.TransactionClient;

type InstallmentRow = {
  id: string;
  creditId: string;
  dueDate: Date;
  amount: { toString(): string };
  status: InstallmentStatus;
  paidAt: Date | null;
  paidDate: Date | null;
  paidAmount: { toString(): string } | null;
  paidAccountId: string | null;
};

const CREDIT_INCLUDE = {
  account: { select: { id: true, name: true, color: true, archivedAt: true } },
  installments: { orderBy: { dueDate: 'asc' } },
} satisfies Prisma.CreditInclude;

type CreditRow = Prisma.CreditGetPayload<{ include: typeof CREDIT_INCLUDE }>;

/** Día del pago: el que eligió la persona; en pagos viejos, el día en que se marcó. */
export function paidKeyOf(
  i: Pick<InstallmentRow, 'status' | 'paidDate' | 'paidAt' | 'dueDate'>,
): string | null {
  if (i.status !== InstallmentStatus.PAID) return null;
  if (i.paidDate) return toDateKey(i.paidDate);
  if (i.paidAt) return toLocalDateKey(i.paidAt);
  return toDateKey(i.dueDate);
}

export function serializeInstallment(row: InstallmentRow) {
  return {
    id: row.id,
    creditId: row.creditId,
    dueDate: toDateKey(row.dueDate),
    amount: decimalToNumber(row.amount),
    status: row.status,
    paidAt: row.paidAt?.toISOString() ?? null,
    paidDate: paidKeyOf(row),
    paidAmount:
      row.paidAmount === null ? null : decimalToNumber(row.paidAmount),
    paidAccountId: row.paidAccountId,
  };
}

type SerializedInstallment = ReturnType<typeof serializeInstallment>;

/** Totales de un crédito para la lista: cuánto se pagó, cuánto falta, la próxima cuota y las vencidas. */
export function creditStats(
  installments: SerializedInstallment[],
  todayKey: string,
) {
  let paidCount = 0;
  let paidTotal = 0;
  let pendingCount = 0;
  let pendingTotal = 0;
  let overdueCount = 0;
  let overdueTotal = 0;
  let nextDue: {
    id: string;
    dueDate: string;
    amount: number;
    daysLate: number;
  } | null = null;
  for (const i of installments) {
    if (i.status === InstallmentStatus.PAID) {
      paidCount++;
      paidTotal = roundMoney(paidTotal + (i.paidAmount ?? i.amount));
    } else if (i.status === InstallmentStatus.PENDING) {
      pendingCount++;
      pendingTotal = roundMoney(pendingTotal + i.amount);
      if (i.dueDate < todayKey) {
        overdueCount++;
        overdueTotal = roundMoney(overdueTotal + i.amount);
      }
      if (!nextDue || i.dueDate < nextDue.dueDate) {
        nextDue = {
          id: i.id,
          dueDate: i.dueDate,
          amount: i.amount,
          daysLate: Math.max(0, daysBetween(i.dueDate, todayKey)),
        };
      }
    }
  }
  return {
    paidCount,
    paidTotal,
    pendingCount,
    pendingTotal,
    overdueCount,
    overdueTotal,
    nextDue,
  };
}

function serializeCredit(row: CreditRow, todayKey: string) {
  const installments = row.installments.map(serializeInstallment);
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
    account: {
      id: row.account.id,
      name: row.account.name,
      color: row.account.color,
      archived: row.account.archivedAt !== null,
    },
    installments,
    ...creditStats(installments, todayKey),
  };
}

@Injectable()
export class FernanceCreditsService {
  constructor(
    private prisma: PrismaService,
    private accounts: FernanceAccountsService,
  ) {}

  async list(userId: string, accountId?: string, status?: CreditStatus) {
    if (accountId) await this.accounts.assertAccount(userId, accountId);
    const rows = await this.prisma.credit.findMany({
      where: {
        userId,
        ...(accountId ? { accountId } : { account: { archivedAt: null } }),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: CREDIT_INCLUDE,
    });
    const today = localTodayKey();
    return rows.map((r) => serializeCredit(r, today));
  }

  async getOne(userId: string, id: string) {
    const row = await this.prisma.credit.findFirst({
      where: { id, userId },
      include: CREDIT_INCLUDE,
    });
    if (!row) throw new NotFoundException('No encontré ese crédito.');
    return serializeCredit(row, localTodayKey());
  }

  async create(userId: string, dto: CreateCreditDto) {
    await this.accounts.assertActiveAccount(userId, dto.accountId);
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
        totalAmount: drafts.reduce((s, d) => s + d.amount, 0),
        installmentAmount: roundPesos(dto.installmentAmount),
        datesCheckedAt: new Date(),
        installments: {
          create: drafts.map((d) => ({ dueDate: d.dueDate, amount: d.amount })),
        },
      },
      include: CREDIT_INCLUDE,
    });
    return serializeCredit(row, localTodayKey());
  }

  async update(userId: string, id: string, dto: UpdateCreditDto) {
    const existing = await this.prisma.credit.findFirst({
      where: { id, userId },
      include: { installments: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('No encontré ese crédito.');
    if (dto.accountId && dto.accountId !== existing.accountId)
      await this.accounts.assertActiveAccount(userId, dto.accountId);

    let status: CreditStatus | undefined;
    if (dto.status) {
      const pending = existing.installments.filter(
        (i) => i.status === InstallmentStatus.PENDING,
      ).length;
      if (dto.status === CreditStatus.CANCELLED)
        status = CreditStatus.CANCELLED;
      else if (dto.status === CreditStatus.ACTIVE)
        status = pending > 0 ? CreditStatus.ACTIVE : CreditStatus.PAID_OFF;
      else if (pending > 0) {
        throw new BadRequestException(
          `Todavía ${pending === 1 ? 'queda 1 cuota' : `quedan ${pending} cuotas`} por pagar: márcalas o rehaz el plan.`,
        );
      } else status = CreditStatus.PAID_OFF;
    }

    await this.prisma.credit.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        accountId: dto.accountId,
        status,
        installmentAmount:
          dto.installmentAmount !== undefined
            ? roundPesos(dto.installmentAmount)
            : undefined,
      },
    });
    return this.getOne(userId, id);
  }

  /** Rehacer las cuotas que faltan: borra las pendientes y crea el plan nuevo. Las pagadas no se tocan. */
  async replan(userId: string, id: string, dto: ReplanCreditDto) {
    const existing = await this.prisma.credit.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('No encontré ese crédito.');
    const drafts = planDrafts(
      dto.count,
      dto.amount,
      parseDateKey(dto.firstDueDate),
      dto.lastAmount,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.creditInstallment.deleteMany({
        where: { creditId: id, status: { not: InstallmentStatus.PAID } },
      });
      await tx.creditInstallment.createMany({
        data: drafts.map((d) => ({
          creditId: id,
          dueDate: d.dueDate,
          amount: d.amount,
        })),
      });
      await tx.credit.update({
        where: { id },
        data: {
          status: CreditStatus.ACTIVE,
          installmentAmount: roundPesos(dto.amount),
          datesCheckedAt: new Date(),
        },
      });
      await this.refresh(tx, id);
    });
    return this.getOne(userId, id);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.credit.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('No encontré ese crédito.');
    await this.prisma.credit.delete({ where: { id } });
    return { ok: true };
  }

  private async assertInstallment(userId: string, installmentId: string) {
    const inst = await this.prisma.creditInstallment.findFirst({
      where: { id: installmentId, credit: { userId } },
      include: { credit: true },
    });
    if (!inst) throw new NotFoundException('No encontré esa cuota.');
    return inst;
  }

  /** Total = suma de las cuotas; estado según lo que falte (un crédito cancelado sigue cancelado). */
  private async refresh(tx: Tx, creditId: string) {
    const [credit, installments] = await Promise.all([
      tx.credit.findUniqueOrThrow({ where: { id: creditId } }),
      tx.creditInstallment.findMany({
        where: { creditId },
        select: { amount: true, status: true },
      }),
    ]);
    const total = installments.reduce(
      (s, i) => roundMoney(s + decimalToNumber(i.amount)),
      0,
    );
    const pending = installments.filter(
      (i) => i.status === InstallmentStatus.PENDING,
    ).length;
    const status =
      credit.status === CreditStatus.CANCELLED
        ? CreditStatus.CANCELLED
        : pending === 0
          ? CreditStatus.PAID_OFF
          : CreditStatus.ACTIVE;
    await tx.credit.update({
      where: { id: creditId },
      data: { totalAmount: total, status },
    });
  }

  async updateInstallment(
    userId: string,
    installmentId: string,
    dto: UpdateInstallmentDto,
  ) {
    const inst = await this.assertInstallment(userId, installmentId);
    if (inst.status !== InstallmentStatus.PENDING) {
      throw new BadRequestException(
        'Solo se cambian las cuotas pendientes. Para una pagada, cambia los datos del pago.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.creditInstallment.update({
        where: { id: installmentId },
        data: {
          dueDate: dto.dueDate ? parseDateKey(dto.dueDate) : undefined,
          amount: dto.amount !== undefined ? roundPesos(dto.amount) : undefined,
        },
      });
      await this.refresh(tx, inst.creditId);
    });
    return this.getOne(userId, inst.creditId);
  }

  async removeInstallment(userId: string, installmentId: string) {
    const inst = await this.assertInstallment(userId, installmentId);
    if (inst.status !== InstallmentStatus.PENDING)
      throw new BadRequestException('Solo se borran cuotas pendientes.');
    const count = await this.prisma.creditInstallment.count({
      where: { creditId: inst.creditId },
    });
    if (count <= 1)
      throw new BadRequestException(
        'Un crédito necesita al menos una cuota. Si ya no aplica, cancélalo o bórralo.',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.creditInstallment.delete({ where: { id: installmentId } });
      await this.refresh(tx, inst.creditId);
    });
    return this.getOne(userId, inst.creditId);
  }

  /** Marcar pagada (o cambiar los datos de un pago): día, valor y cuenta reales. */
  async payInstallment(
    userId: string,
    installmentId: string,
    dto: PayInstallmentDto = {},
  ) {
    const inst = await this.assertInstallment(userId, installmentId);
    const today = localTodayKey();
    const paidKey =
      dto.paidDate ??
      (inst.status === InstallmentStatus.PAID
        ? (paidKeyOf(inst) ?? today)
        : today);
    if (daysBetween(today, paidKey) > 1)
      throw new BadRequestException('La fecha del pago no puede ser futura.');
    if (dto.accountId)
      await this.accounts.assertActiveAccount(userId, dto.accountId);

    const accountId =
      dto.accountId !== undefined ? dto.accountId : inst.paidAccountId;
    const amount = decimalToNumber(inst.amount);
    const paidAmount =
      dto.paidAmount !== undefined
        ? roundPesos(dto.paidAmount)
        : inst.paidAmount === null
          ? null
          : decimalToNumber(inst.paidAmount);

    await this.prisma.$transaction(async (tx) => {
      await tx.creditInstallment.update({
        where: { id: installmentId },
        data: {
          status: InstallmentStatus.PAID,
          paidAt: inst.paidAt ?? new Date(),
          paidDate: parseDateKey(paidKey),
          paidAmount:
            paidAmount === null || paidAmount === amount ? null : paidAmount,
          paidAccountId:
            accountId && accountId !== inst.credit.accountId ? accountId : null,
        },
      });
      await this.refresh(tx, inst.creditId);
    });
    return this.getOne(userId, inst.creditId);
  }

  async unpayInstallment(userId: string, installmentId: string) {
    const inst = await this.assertInstallment(userId, installmentId);
    await this.prisma.$transaction(async (tx) => {
      await tx.creditInstallment.update({
        where: { id: installmentId },
        data: {
          status: InstallmentStatus.PENDING,
          paidAt: null,
          paidDate: null,
          paidAmount: null,
          paidAccountId: null,
        },
      });
      await this.refresh(tx, inst.creditId);
    });
    return this.getOne(userId, inst.creditId);
  }
}
