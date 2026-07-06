import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, CollabTaskKind, TaskStatus, WorkspaceRole } from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { CollabDailyInstancesService } from './collab-daily-instances.service';
import {
  buildComplianceReport,
  parseComplianceRange,
  taskActiveFromKey,
} from './collab-compliance.utils';
import { PermissionsService } from './permissions.service';

@Injectable()
export class CollabComplianceService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private activity: ActivityService,
    private dailyInstances: CollabDailyInstancesService,
  ) {}

  async complete(userId: string, taskId: string, dateKey: string) {
    const task = await this.getDailyTask(taskId);
    await this.permissions.requireProjectAccess(userId, task.projectId, WorkspaceRole.EDITOR);
    this.assertDateAllowed(task, dateKey);

    await this.prisma.collabTaskCompletion.upsert({
      where: { taskId_date: { taskId, date: parseDateKey(dateKey) } },
      create: { taskId, date: parseDateKey(dateKey), completedById: userId },
      update: { completedById: userId },
    });

    await this.syncInstanceStatus(taskId, dateKey, TaskStatus.DONE);

    await this.activity.log({
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      actorId: userId,
      action: ActivityAction.COMPLETED,
      targetType: 'collab_task',
      targetId: taskId,
      metadata: { date: dateKey, kind: 'DAILY' },
    });

    return { ok: true, taskId, date: dateKey };
  }

  async uncomplete(userId: string, taskId: string, dateKey: string) {
    const task = await this.getDailyTask(taskId);
    await this.permissions.requireProjectAccess(userId, task.projectId, WorkspaceRole.EDITOR);
    this.assertDateAllowed(task, dateKey);

    await this.prisma.collabTaskCompletion.deleteMany({
      where: { taskId, date: parseDateKey(dateKey) },
    });

    await this.syncInstanceStatus(taskId, dateKey, TaskStatus.TODO);

    await this.activity.log({
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      actorId: userId,
      action: ActivityAction.UNCOMPLETED,
      targetType: 'collab_task',
      targetId: taskId,
      metadata: { date: dateKey, kind: 'DAILY' },
    });

    return { ok: true, taskId, date: dateKey };
  }

  async getProjectCompliance(
    userId: string,
    projectId: string,
    from?: string,
    to?: string,
    assigneeId?: string,
  ) {
    await this.permissions.requireProjectAccess(userId, projectId, WorkspaceRole.VIEWER);
    const range = parseComplianceRange(from, to, 30);
    await this.dailyInstances.ensureRangeForProject(projectId, range.from, range.to);

    const tasks = await this.prisma.collabTask.findMany({
      where: {
        projectId,
        kind: CollabTaskKind.DAILY,
        ...(assigneeId ? { assigneeId } : {}),
      },
      include: {
        completions: { where: { date: { gte: parseDateKey(range.from), lte: parseDateKey(range.to) } } },
        assignee: { select: { id: true, fullName: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return buildComplianceReport(projectId, tasks, range.from, range.to);
  }

  async listDailyTasksForDate(userId: string, projectId: string, dateKey?: string) {
    await this.permissions.requireProjectAccess(userId, projectId, WorkspaceRole.VIEWER);
    const ref = dateKey ?? toDateKey(new Date());
    await this.dailyInstances.ensureForProject(projectId, ref);

    const tasks = await this.prisma.collabTask.findMany({
      where: { projectId, kind: CollabTaskKind.DAILY },
      include: {
        assignee: { select: { id: true, username: true, fullName: true, email: true } },
        completions: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const activeTasks = tasks.filter((t) => taskActiveFromKey(t) <= ref);

    const range7 = parseComplianceRange(undefined, undefined, 7);
    const report7 = buildComplianceReport(projectId, tasks, range7.from, range7.to);

    return activeTasks.map((task) => {
      const keys = new Set(task.completions.map((c) => toDateKey(c.date)));
      const row = report7.tasks.find((r) => r.taskId === task.id);
      return {
        ...task,
        completedOnDate: keys.has(ref),
        rate7d: row?.rate ?? 0,
        currentStreak: row?.currentStreak ?? 0,
      };
    });
  }

  async loadWorkspaceDailyTasks(workspaceId: string) {
    return this.prisma.collabTask.findMany({
      where: { workspaceId, kind: CollabTaskKind.DAILY },
      include: {
        completions: true,
        assignee: { select: { id: true, fullName: true } },
      },
    });
  }

  private async getDailyTask(taskId: string) {
    const task = await this.prisma.collabTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    if (task.kind !== CollabTaskKind.DAILY) {
      throw new BadRequestException('Solo las rutinas diarias admiten marcado por fecha');
    }
    return task;
  }

  private assertDateAllowed(task: { activeFrom: Date | null; createdAt: Date }, dateKey: string) {
    const min = taskActiveFromKey(task);
    if (dateKey < min) {
      throw new ForbiddenException('No puedes marcar antes del inicio de la rutina');
    }
  }

  private async syncInstanceStatus(templateId: string, dateKey: string, status: TaskStatus) {
    const instance = await this.prisma.collabTask.findFirst({
      where: { sourceDailyId: templateId, scheduledDate: parseDateKey(dateKey) },
    });
    if (instance && instance.status !== status) {
      await this.prisma.collabTask.update({ where: { id: instance.id }, data: { status } });
    }
  }
}
