import { toDateKey } from '../common/date.utils';
import type { PrismaService } from '../prisma/prisma.service';
import { toHistoryHabit, type HistoryHabit, type PauseRange } from './history.utils';

/** Pausas del usuario (de todos los habitos y de cada uno), en claves. */
export async function loadPauses(prisma: PrismaService, userId: string): Promise<PauseRange[]> {
  const rows = await prisma.habitPause.findMany({
    where: { userId },
    orderBy: { startDate: 'asc' },
    select: { id: true, habitId: true, startDate: true, endDate: true, note: true },
  });
  return rows.map((r) => ({ id: r.id, habitId: r.habitId, startKey: toDateKey(r.startDate), endKey: toDateKey(r.endDate), note: r.note }));
}

/** Habitos activos (o uno en concreto, aunque este archivado) con todo su historial y sus pausas. */
export async function loadHistory(
  prisma: PrismaService,
  userId: string,
  opts: { habitId?: string } = {},
): Promise<{ history: HistoryHabit[]; pauses: PauseRange[] }> {
  const [habits, pauses] = await Promise.all([
    prisma.habit.findMany({
      where: opts.habitId ? { userId, id: opts.habitId } : { userId, archived: false },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        completions: { select: { date: true, createdAt: true } },
        relapses: { select: { date: true } },
        freezes: { select: { date: true } },
      },
    }),
    loadPauses(prisma, userId),
  ]);
  return { history: habits.map((h) => toHistoryHabit(h, pauses)), pauses };
}
