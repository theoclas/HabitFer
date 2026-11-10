import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { legacyDateFixes } from './fernance.utils';

/**
 * Arreglo de una sola vez, al arrancar: los créditos creados antes de la fase 0 podían tener cuotas corridas
 * (si la primera caía el 29, 30 o 31, una se iba al mes siguiente y otro mes quedaba sin cuota). Se corrigen
 * solo las pendientes que tienen exactamente la fecha que daba el cálculo viejo, y cada crédito queda marcado
 * como revisado para no tocarlo nunca más.
 */
@Injectable()
export class FernanceMaintenanceService implements OnApplicationBootstrap {
  private readonly logger = new Logger('FerFinance');

  constructor(private prisma: PrismaService) {}

  onApplicationBootstrap() {
    // Sin esperar: el arranque de la API no depende de esto.
    void this.fixLegacyDueDates()
      .then((r) => {
        if (r.credits > 0)
          this.logger.log(
            `Fechas de cuotas revisadas: ${r.credits} créditos, ${r.fixed} cuotas corregidas.`,
          );
      })
      .catch((err: unknown) =>
        this.logger.warn(
          `No se pudieron revisar las fechas de las cuotas: ${String(err)}`,
        ),
      );
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
}
