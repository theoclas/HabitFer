import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, CollabNotificationType, CollabTaskKind, TaskPriority, TaskStatus, WorkspaceRole } from '@prisma/client';
import { localTodayKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { CollabDailyInstancesService } from './collab-daily-instances.service';
import { CollabNotificationsService } from './notifications.service';
import { PermissionsService } from './permissions.service';

@Injectable()
export class CollabTasksService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private activity: ActivityService,
    private notifications: CollabNotificationsService,
    private dailyInstances: CollabDailyInstancesService,
  ) {}

  async create(
    userId: string,
    projectId: string,
    data: {
      title: string;
      description?: string;
      kind?: CollabTaskKind;
      activeFrom?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string;
      dueDate?: string;
      dueTime?: string;
    },
  ) {
    const { project } = await this.permissions.requireProjectAccess(userId, projectId, WorkspaceRole.EDITOR);
    if (data.assigneeId) await this.ensureWorkspaceMember(data.assigneeId, project.workspaceId);

    const isDaily = data.kind === CollabTaskKind.DAILY;
    const activeFrom = isDaily
      ? data.activeFrom
        ? new Date(data.activeFrom)
        : new Date(localTodayKey())
      : data.activeFrom
        ? new Date(data.activeFrom)
        : undefined;

    const task = await this.prisma.collabTask.create({
      data: {
        workspaceId: project.workspaceId,
        projectId,
        title: data.title.trim(),
        description: data.description?.trim(),
        kind: data.kind ?? CollabTaskKind.ONE_OFF,
        status: isDaily ? TaskStatus.TODO : (data.status ?? TaskStatus.TODO),
        priority: data.priority ?? TaskPriority.MEDIUM,
        assigneeId: data.assigneeId,
        createdById: userId,
        dueDate: isDaily ? undefined : data.dueDate ? new Date(data.dueDate) : undefined,
        dueTime: isDaily ? undefined : data.dueTime,
        activeFrom,
      },
      include: {
        assignee: { select: { id: true, username: true, fullName: true } },
      },
    });

    await this.activity.log({
      workspaceId: project.workspaceId,
      projectId,
      actorId: userId,
      action: ActivityAction.CREATED,
      targetType: 'collab_task',
      targetId: task.id,
    });
    if (data.assigneeId) {
      await this.activity.log({
        workspaceId: project.workspaceId,
        projectId,
        actorId: userId,
        action: ActivityAction.ASSIGNED,
        targetType: 'collab_task',
        targetId: task.id,
        metadata: { assigneeId: data.assigneeId },
      });
      if (data.assigneeId !== userId) {
        await this.notifications.notify(
          data.assigneeId,
          CollabNotificationType.TASK_ASSIGNED,
          'Nueva tarea asignada',
          task.title,
          { taskId: task.id, projectId },
        );
      }
    }

    if (isDaily) {
      await this.dailyInstances.ensureForProject(projectId, localTodayKey());
    }

    return task;
  }

  async update(
    userId: string,
    taskId: string,
    data: {
      title?: string;
      description?: string;
      kind?: CollabTaskKind;
      activeFrom?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string | null;
      dueDate?: string | null;
      dueTime?: string | null;
    },
  ) {
    const task = await this.prisma.collabTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    await this.permissions.requireProjectAccess(userId, task.projectId, WorkspaceRole.EDITOR);
    if (data.assigneeId) await this.ensureWorkspaceMember(data.assigneeId, task.workspaceId);

    const updated = await this.prisma.collabTask.update({
      where: { id: taskId },
      data: {
        title: data.title?.trim(),
        description: data.description?.trim(),
        kind: data.kind,
        activeFrom:
          data.activeFrom === null
            ? null
            : data.activeFrom
              ? new Date(data.activeFrom)
              : undefined,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId === null ? null : data.assigneeId,
        dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined,
        dueTime: data.dueTime === null ? null : data.dueTime,
      },
      include: {
        assignee: { select: { id: true, username: true, fullName: true } },
      },
    });

    if (data.status && data.status !== task.status) {
      if (task.sourceDailyId) {
        await this.dailyInstances.syncFromInstance(taskId, data.status, userId);
      }
      await this.activity.log({
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: userId,
        action: ActivityAction.STATUS_CHANGED,
        targetType: 'collab_task',
        targetId: taskId,
        metadata: { from: task.status, to: data.status },
      });
    }
    if (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
      await this.activity.log({
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: userId,
        action: ActivityAction.ASSIGNED,
        targetType: 'collab_task',
        targetId: taskId,
        metadata: { assigneeId: data.assigneeId },
      });
      if (data.assigneeId && data.assigneeId !== userId) {
        await this.notifications.notify(
          data.assigneeId,
          CollabNotificationType.TASK_ASSIGNED,
          'Tarea reasignada',
          updated.title,
          { taskId, projectId: task.projectId },
        );
      }
    }
    return updated;
  }

  async remove(userId: string, taskId: string) {
    const task = await this.prisma.collabTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    await this.permissions.requireProjectAccess(userId, task.projectId, WorkspaceRole.EDITOR);
    await this.prisma.collabTask.delete({ where: { id: taskId } });
    await this.activity.log({
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      actorId: userId,
      action: ActivityAction.DELETED,
      targetType: 'collab_task',
      targetId: taskId,
    });
    return { ok: true };
  }

  private async ensureWorkspaceMember(userId: string, workspaceId: string) {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m) throw new BadRequestException('El usuario no es miembro del workspace');
  }
}
