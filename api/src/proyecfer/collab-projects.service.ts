import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, CollabTaskKind, WorkspaceRole } from '@prisma/client';
import { localTodayKey } from '../common/date.utils';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { CollabDailyInstancesService } from './collab-daily-instances.service';
import { PermissionsService } from './permissions.service';

@Injectable()
export class CollabProjectsService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private activity: ActivityService,
    private dailyInstances: CollabDailyInstancesService,
  ) {}
  async list(userId: string, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(userId, workspaceId, WorkspaceRole.VIEWER);
    const projects = await this.prisma.collabProject.findMany({
      where: { workspaceId, archived: false },
      orderBy: { createdAt: 'desc' },
      include: {
          _count: { select: { tasks: { where: { kind: CollabTaskKind.ONE_OFF, status: { not: 'DONE' } } } } },
        },
    });
    return projects.map((p) => ({ ...p, openTasks: p._count.tasks }));
  }

  async create(userId: string, workspaceId: string, data: { name: string; description?: string; color?: string }) {
    await this.permissions.requireWorkspaceRole(userId, workspaceId, WorkspaceRole.EDITOR);
    const project = await this.prisma.collabProject.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        description: data.description?.trim(),
        color: data.color ?? '#3b82f6',
      },
    });
    await this.activity.log({
      workspaceId,
      projectId: project.id,
      actorId: userId,
      action: ActivityAction.CREATED,
      targetType: 'collab_project',
      targetId: project.id,
    });
    return project;
  }

  async getOne(userId: string, projectId: string) {
    const { project } = await this.permissions.requireProjectAccess(userId, projectId);
    await this.dailyInstances.ensureForProject(projectId, localTodayKey());

    const full = await this.prisma.collabProject.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          where: { kind: { not: CollabTaskKind.DAILY } },
          orderBy: [{ status: 'asc' }, { scheduledDate: 'desc' }, { createdAt: 'desc' }],
          include: {
            assignee: { select: { id: true, username: true, fullName: true, email: true } },
            createdBy: { select: { id: true, username: true, fullName: true, email: true } },
            sourceDaily: { select: { id: true, title: true } },
          },
        },
        pages: { where: { parentPageId: null }, orderBy: { sortOrder: 'asc' } },        workGuides: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          include: { _count: { select: { steps: true } } },
        },
        members: {
          include: { user: { select: { id: true, username: true, fullName: true, email: true } } },
        },
      },
    });
    if (!full) throw new NotFoundException('Proyecto no encontrado');

    const dailyTemplates = await this.prisma.collabTask.findMany({
      where: { projectId, kind: CollabTaskKind.DAILY },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        assignee: { select: { id: true, username: true, fullName: true, email: true } },
      },
    });

    const workspaceMembers = await this.prisma.workspaceMember.findMany({      where: { workspaceId: full.workspaceId },
      include: { user: { select: { id: true, username: true, fullName: true, email: true } } },
    });

    return {
      ...full,
      dailyTemplates,
      members:        full.members.length > 0
          ? full.members
          : workspaceMembers.map((m) => ({ user: m.user, role: m.role })),
    };
  }

  async update(userId: string, projectId: string, data: { name?: string; description?: string; color?: string; archived?: boolean }) {
    const { project } = await this.permissions.requireProjectAccess(userId, projectId, WorkspaceRole.EDITOR);
    const updated = await this.prisma.collabProject.update({
      where: { id: projectId },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
        color: data.color,
        archived: data.archived,
      },
    });
    await this.activity.log({
      workspaceId: project.workspaceId,
      projectId,
      actorId: userId,
      action: ActivityAction.UPDATED,
      targetType: 'collab_project',
      targetId: projectId,
    });
    return updated;
  }
}
