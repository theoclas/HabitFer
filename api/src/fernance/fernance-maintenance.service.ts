import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { FinanceTxSource, FinanceTxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { legacyDateFixes } from './fernance.utils';
import { FernanceCategoriesService } from './fernance-categories.service';
import { categoryFromText } from './text/money-text.parse';

/**
 * Arreglos de una sola vez, al arrancar la API:
 * - Fase 0: los créditos creados antes podían tener cuotas corridas (si la primera caía el 29, 30 o 31). Se
 *   corrigen solo las pendientes con exactamente la fecha del cálculo viejo, y cada crédito queda revisado.
 * - Fase 1: los ingresos pasan a los movimientos (con el mismo id y, si la descripción lo dice, su categoría). La
 *   tabla vieja queda como respaldo, con la marca de que ya pasó.
 */
@Injectable()
export class FernanceMaintenanceService implements OnApplicationBootstrap {
  private readonly logger = new Logger('FerFinance');

  constructor(
    private prisma: PrismaService,
    private categories: FernanceCategoriesService,
  ) {}

  async onApplicationBootstrap() {
    // La API arranca aunque esto falle; se reintenta en el próximo arranque.
    try {
      const r = await this.fixLegacyDueDates();
      if (r.credits > 0)
        this.logger.log(
          `Fechas de cuotas revisadas: ${r.credits} créditos, ${r.fixed} cuotas corregidas.`,
        );
    } catch (err: unknown) {
      this.logger.warn(
        `No se pudieron revisar las fechas de las cuotas: ${String(err)}`,
      );
    }
    try {
      const m = await this.migrateLegacyIncomes();
      if (m.incomes > 0)
        this.logger.log(
          `Ingresos pasados a movimientos: ${m.incomes} (${m.categorized} con categoría).`,
        );
    } catch (err: unknown) {
      this.logger.warn(
        `No se pudieron pasar los ingresos a movimientos: ${String(err)}`,
      );
    }
  }

  async fixLegacyDueDates(): Promise<{ credits: number; fixed: number }> {
    const credits = await this.prisma.credit.findMany({
      where: { datesCheckedAt: null },
      select: {
        id: true,
        installments: {
          select: { id: true, dueDate: true, status: true },
          orderBy: { dueDate: 'asc' },
        },
      },
    });
    let fixed = 0;
    for (const credit of credits) {
      const fixes = legacyDateFixes(credit.installments);
      await this.prisma.$transaction([
        ...fixes.map((f) =>
          this.prisma.creditInstallment.update({
            where: { id: f.id },
            data: { dueDate: f.dueDate },
          }),
        ),
        this.prisma.credit.update({
          where: { id: credit.id },
          data: { datesCheckedAt: new Date() },
        }),
      ]);
      fixed += fixes.length;
    }
    return { credits: credits.length, fixed };
  }

  /** Pasa los ingresos de la tabla vieja a los movimientos. Se puede correr las veces que sea: no duplica. */
  async migrateLegacyIncomes(): Promise<{
    incomes: number;
    categorized: number;
  }> {
    const pending = await this.prisma.income.findMany({
      where: { migratedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!pending.length) return { incomes: 0, categorized: 0 };
    let incomes = 0;
    let categorized = 0;
    const byUser = new Map<string, typeof pending>();
    for (const i of pending)
      byUser.set(i.userId, [...(byUser.get(i.userId) ?? []), i]);
    for (const [userId, rows] of byUser) {
      await this.categories.ensureSeeded(userId);
      const [cats, keywords] = await Promise.all([
        this.prisma.financeCategory.findMany({
          where: { userId, archivedAt: null },
          select: {
            id: true,
            kind: true,
            systemKey: true,
            parentId: true,
            name: true,
          },
        }),
        this.prisma.financeKeyword.findMany({
          where: { userId },
          select: { keyword: true, categoryId: true, accountId: true },
        }),
      ]);
      for (let k = 0; k < rows.length; k += 500) {
        const chunk = rows.slice(k, k + 500);
        const data = chunk.map((i) => {
          const categoryId = i.description
            ? categoryFromText(i.description, 'INCOME', {
                categories: cats,
                keywords,
              })
            : null;
          if (categoryId) categorized++;
          return {
            id: i.id,
            userId,
            type: FinanceTxType.INCOME,
            accountId: i.accountId,
            amount: i.amount,
            date: i.date,
            note: i.description,
            categoryId,
            source: FinanceTxSource.LEGACY,
            createdAt: i.createdAt,
          };
        });
        await this.prisma.$transaction([
          this.prisma.financeTransaction.createMany({
            data,
            skipDuplicates: true,
          }),
          this.prisma.income.updateMany({
            where: { id: { in: chunk.map((i) => i.id) } },
            data: { migratedAt: new Date() },
          }),
        ]);
        incomes += chunk.length;
      }
    }
    return { incomes, categorized };
  }
}
