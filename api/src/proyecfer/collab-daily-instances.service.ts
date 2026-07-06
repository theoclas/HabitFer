import { Injectable } from '@nestjs/common';
import { CollabTaskKind, TaskStatus } from '@prisma/client';
import { localTodayKey, parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { taskActiveFromKey } from './collab-compliance.utils';

@Injectable()
export class CollabDailyInstancesService {
  constructor(private prisma: PrismaService) {}

  /** Crea instancias ONE_OFF pendientes para cada plantilla DAILY activa en la fecha. */
  async ensureForProject(projectId: string, dateKey?: string) {
    const ref = dateKey ?? localTodayKey();
    const refDate = parseDateKey(ref);

    const templates = await this.prisma.collabTask.findMany({
      where: { projectId, kind: CollabTaskKind.DAILY },
      include: { completions: { where: { date: refDate } } },
    });

    for (const template of templates) {
      if (taskActiveFromKey(template) > ref) continue;

      const existing = await this.prisma.collabTask.findFirst({
        where: { sourceDailyId: template.id, scheduledDate: refDate },
      });
      if (existing) continue;

      const alreadyDone = template.completions.length > 0;
      const formatted = ref.split('-').reverse().join('/');

      await this.prisma.collabTask.create({
        data: {
          workspaceId: template.workspaceId,
          projectId: template.projectId,
          title: `${template.title} — ${formatted}`,
          description: template.description,
          kind: CollabTaskKind.ONE_OFF,
          status: alreadyDone ? TaskStatus.DONE : TaskStatus.TODO,
          priority: template.priority,
          assigneeId: template.assigneeId,
          createdById: template.createdById,
          dueDate: refDate,
          sourceDailyId: template.id,
          scheduledDate: refDate,
        },
      });
    }
  }

  /** Sincroniza completion de plantilla al marcar instancia como hecha/pendiente. */
  async syncFromInstance(instanceId: string, status: TaskStatus, userId: string) {
    const instance = await this.prisma.collabTask.findUnique({ where: { id: instanceId } });
    if (!instance?.sourceDailyId || !instance.scheduledDate) return;

    const date = instance.scheduledDate;
    if (status === TaskStatus.DONE) {
      await this.prisma.collabTaskCompletion.upsert({
        where: {
          taskId_date: { taskId: instance.sourceDailyId, date },
        },
        create: {
          taskId: instance.sourceDailyId,
          date,
          completedById: userId,
        },
        update: { completedById: userId },
      });
    } else {
      await this.prisma.collabTaskCompletion.deleteMany({
        where: { taskId: instance.sourceDailyId, date },
      });
    }
  }

  async ensureRangeForProject(projectId: string, from: string, to: string) {
    let cursor = parseDateKey(from);
    const end = parseDateKey(to);
    while (cursor.getTime() <= end.getTime()) {
      await this.ensureForProject(projectId, toDateKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
}
