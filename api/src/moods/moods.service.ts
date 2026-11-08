import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { addDays, isCompletableDate, parseDateKey, startOfToday, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class MoodsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, from?: string, to?: string) {
    const today = startOfToday();
    const fromDate = from && DATE_KEY.test(from) ? parseDateKey(from) : addDays(today, -29);
    const toDate = to && DATE_KEY.test(to) ? parseDateKey(to) : today;
    const rows = await this.prisma.dayMood.findMany({
      where: { userId, date: { gte: fromDate, lte: toDate } },
      orderBy: { date: 'asc' },
      select: { date: true, mood: true },
    });
    return rows.map((r) => ({ date: toDateKey(r.date), mood: r.mood }));
  }

  async set(userId: string, dateKey: string, mood: number) {
    const date = this.checkDate(dateKey);
    const row = await this.prisma.dayMood.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, mood },
      update: { mood },
      select: { date: true, mood: true },
    });
    return { date: toDateKey(row.date), mood: row.mood };
  }

  async remove(userId: string, dateKey: string) {
    const date = this.checkDate(dateKey);
    await this.prisma.dayMood.deleteMany({ where: { userId, date } });
    return { ok: true };
  }

  /** Igual que los habitos: el animo se registra para hoy o ayer. */
  private checkDate(dateKey: string) {
    if (!DATE_KEY.test(dateKey)) throw new BadRequestException('Fecha invalida');
    const date = parseDateKey(dateKey);
    if (!isCompletableDate(date)) throw new ForbiddenException('Solo puedes registrar el animo de hoy o de ayer');
    return date;
  }
}
