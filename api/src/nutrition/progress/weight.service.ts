import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { WeightSource } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { localTodayKey, parseDateKey, toDateKey } from '../../common/date.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { checkedDate } from '../entry.shared';
import { shiftKey } from './days';
import { trendSummary, weightTrend } from './trend';
import { parseWeighDate, parseWeight } from './weight-parse';

const r2 = (n: number) => Math.round(n * 100) / 100;
const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');
/** La tendencia arranca este tanto antes de lo que se muestra, para no empezar «fría». */
const TREND_WARMUP_DAYS = 60;

/** El peso: anotado a mano o mandado por el atajo de iOS desde Apple Salud. */
@Injectable()
export class WeightService {
  constructor(private prisma: PrismaService) {}

  /** Pesadas de los últimos `days` días, con su tendencia y un resumen. */
  async list(userId: string, days: number) {
    const today = localTodayKey();
    const since = shiftKey(today, -days);
    const [rows, shortcut] = await Promise.all([
      this.prisma.bodyWeight.findMany({
        where: { userId, date: { gte: parseDateKey(shiftKey(since, -TREND_WARMUP_DAYS)) } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.nutritionShortcut.findUnique({ where: { userId }, select: { hint: true, lastUsedAt: true, createdAt: true } }),
    ]);
    const sourceBy = new Map(rows.map((r) => [toDateKey(r.date), r.source]));
    const trend = weightTrend(rows.map((r) => ({ date: toDateKey(r.date), kg: r.kg })));
    const summary = trendSummary(trend);
    return {
      today,
      points: trend
        .filter((p) => p.date >= since)
        .map((p) => ({ date: p.date, kg: r2(p.kg), trend: r2(p.trend), source: sourceBy.get(p.date) ?? WeightSource.MANUAL })),
      summary: summary && {
        date: summary.last.date,
        kg: r2(summary.last.kg),
        trend: r2(summary.last.trend),
        change7: summary.change7 == null ? null : r2(summary.change7),
        change30: summary.change30 == null ? null : r2(summary.change30),
        weeklyRate: summary.weeklyRate == null ? null : r2(summary.weeklyRate),
      },
      shortcut: shortcut
        ? { hint: shortcut.hint, lastUsedAt: shortcut.lastUsedAt?.toISOString() ?? null, createdAt: shortcut.createdAt.toISOString() }
        : null,
    };
  }

  /** Anotar (o cambiar) el peso de un día. */
  async set(userId: string, dateKey: string, kg: number, source: WeightSource = WeightSource.MANUAL) {
    const date = checkedDate(dateKey);
    if (dateKey > localTodayKey()) throw new BadRequestException('No se puede anotar el peso de un día que aún no llega.');
    const value = r2(kg);
    await this.prisma.bodyWeight.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, kg: value, source },
      update: { kg: value, source },
    });
    return { date: dateKey, kg: value, source };
  }

  async remove(userId: string, dateKey: string) {
    const { count } = await this.prisma.bodyWeight.deleteMany({ where: { userId, date: checkedDate(dateKey) } });
    return { removed: count };
  }

  /** Llave nueva para el atajo (reemplaza la anterior). Solo se muestra esta vez; se guarda su huella. */
  async createShortcut(userId: string) {
    const token = `nf_${randomBytes(24).toString('base64url')}`;
    const hint = token.slice(-4);
    await this.prisma.nutritionShortcut.upsert({
      where: { userId },
      create: { userId, tokenHash: hashOf(token), hint },
      update: { tokenHash: hashOf(token), hint, lastUsedAt: null, createdAt: new Date() },
    });
    return { token, hint };
  }

  async removeShortcut(userId: string) {
    const { count } = await this.prisma.nutritionShortcut.deleteMany({ where: { userId } });
    return { removed: count };
  }

  /** Lo que manda el atajo: { llave, peso, fecha? }. La llave también puede venir en el encabezado. */
  async ingest(token: string | undefined, body: Record<string, unknown> | undefined) {
    const key = token?.trim();
    const link = key ? await this.prisma.nutritionShortcut.findUnique({ where: { tokenHash: hashOf(key) } }) : null;
    if (!link) throw new UnauthorizedException('Esa llave no sirve. Crea una nueva en NutriFer › Progreso › Apple Salud.');
    const b = body ?? {};
    const kg = parseWeight(b.peso ?? b.kg ?? b.weight ?? b.valor ?? b.value);
    if (kg == null) throw new BadRequestException('No entendí el peso. Manda un número en kilos, como 72,5.');
    const today = localTodayKey();
    const date = parseWeighDate(b.fecha ?? b.date, today);
    const saved = await this.set(link.userId, date, kg, WeightSource.SHORTCUT);
    await this.prisma.nutritionShortcut.update({ where: { userId: link.userId }, data: { lastUsedAt: new Date() } });
    const { summary } = await this.list(link.userId, 7);
    return { ok: true, fecha: saved.date, peso: saved.kg, tendencia: summary?.trend ?? saved.kg };
  }
}
