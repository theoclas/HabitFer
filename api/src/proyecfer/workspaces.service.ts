import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, CollabTaskKind, UserStatus, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { buildWorkspaceDailyRates, projectDailyRate } from './collab-compliance.utils';
import { PermissionsService } from './permissions.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private activity: ActivityService,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: { select: { projects: { where: { archived: false } }, members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => ({
      ...m.workspace,
      myRole: m.role,
      projectCount: m.workspace._count.projects,
      memberCount: m.workspace._count.members,
    }));
  }

  async create(userId: string, data: { name: string; description?: string; icon?: string }) {
    const workspace = await this.prisma.workspace.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim(),
        icon: data.icon,
        ownerId: userId,
        members: { create: { userId, role: WorkspaceRole.OWNER } },
      },
    });
    await this.activity.log({
      workspaceId: workspace.id,
      actorId: userId,
      action: ActivityAction.CREATED,
      targetType: 'workspace',
      targetId: workspace.id,
    });
    return workspace;
  }

  async getOne(userId: string, id: string) {
    await this.permissions.requireWorkspaceRole(userId, id, WorkspaceRole.VIEWER);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, fullName: true, email: true } } },
        },
        _count: { select: { projects: true } },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace no encontrado');
    const myRole = await this.permissions.getWorkspaceRole(userId, id);
    return { ...workspace, myRole };
  }

  async update(userId: string, id: string, data: { name?: string; description?: string; icon?: string; archived?: boolean }) {
    await this.permissions.requireWorkspaceRole(userId, id, WorkspaceRole.EDITOR);
    const updated = await this.prisma.workspace.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
        icon: data.icon,
        archived: data.archived,
      },
    });
    await this.activity.log({
      workspaceId: id,
      actorId: userId,
      action: ActivityAction.UPDATED,
      targetType: 'workspace',
      targetId: id,
    });
    return updated;
  }

  async addMember(userId: string, workspaceId: string, targetUserId: string, role: WorkspaceRole) {
    const callerRole = await this.permissions.requireWorkspaceRole(userId, workspaceId, WorkspaceRole.ADMIN);
    this.permissions.assertCanAssignRole(callerRole, role);

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException('El usuario no esta activo');

    const member = await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      create: { workspaceId, userId: targetUserId, role },
      update: { role },
      include: { user: { select: { id: true, username: true, fullName: true } } },
    });

    await this.activity.log({
      workspaceId,
      actorId: userId,
      action: ActivityAction.MEMBER_ADDED,
      targetType: 'user',
      targetId: targetUserId,
      metadata: { role },
    });
    return member;
  }

  async removeMember(userId: string, workspaceId: string, targetUserId: string) {
    const callerRole = await this.permissions.requireWorkspaceRole(userId, workspaceId, WorkspaceRole.ADMIN);
    const targetMember = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!targetMember) throw new NotFoundException('Miembro no encontrado');
    this.permissions.assertCanManageMember(callerRole, targetMember.role);

    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    await this.activity.log({
      workspaceId,
      actorId: userId,
      action: ActivityAction.MEMBER_REMOVED,
      targetType: 'user',
      targetId: targetUserId,
    });
    return { ok: true };
  }

  async searchUsers(userId: string, workspaceId: string, q: string) {
    await this.permissions.requireWorkspaceRole(userId, workspaceId, WorkspaceRole.EDITOR);
    const term = q.trim();
    if (!term || term.length < 2) return [];

    const members = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        OR: [
          { username: { contains: term } },
          { fullName: { contains: term } },
        ],
      },
      select: { id: true, username: true, fullName: true },
      take: 20,
    });

    return members;
  }

  async getStats(userId: string, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(userId, workspaceId, WorkspaceRole.VIEWER);

    const [projects, tasks, dailyTasks, memberCount, guideCount, pageCount] = await Promise.all([
      this.prisma.collabProject.findMany({
        where: { workspaceId, archived: false },
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { workGuides: true } },
        },
      }),
      this.prisma.collabTask.findMany({
        where: { workspaceId, kind: CollabTaskKind.ONE_OFF },
        include: { assignee: { select: { id: true, fullName: true } } },
      }),
      this.prisma.collabTask.findMany({
        where: { workspaceId, kind: CollabTaskKind.DAILY },
        include: {
          completions: true,
          assignee: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.workspaceMember.count({ where: { workspaceId } }),
      this.prisma.workGuide.count({ where: { workspaceId } }),
      this.prisma.page.count({ where: { workspaceId } }),
    ]);

    const dailyRates = buildWorkspaceDailyRates(dailyTasks);

    const byAssignee: Record<string, number> = {};
    const byStatus = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };

    for (const t of tasks) {
      const key = t.assignee?.fullName ?? 'Sin asignar';
      byAssignee[key] = (byAssignee[key] ?? 0) + 1;
      if (t.status in byStatus) {
        byStatus[t.status as keyof typeof byStatus] += 1;
      }
    }

    const openTasks = byStatus.TODO + byStatus.IN_PROGRESS;
    const doneTasks = byStatus.DONE;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const projectSummaries = projects.map((p) => {
      const projectTasks = tasks.filter((t) => t.projectId === p.id);
      const dailyCount = dailyTasks.filter((t) => t.projectId === p.id).length;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        description: p.description,
        openTasks: projectTasks.filter((t) => t.status !== 'DONE').length,
        doneTasks: projectTasks.filter((t) => t.status === 'DONE').length,
        totalTasks: projectTasks.length,
        dailyTaskCount: dailyCount,
        dailyComplianceRate7d: projectDailyRate(dailyTasks, p.id, 7),
        guideCount: p._count.workGuides,
        updatedAt: p.updatedAt,
      };
    });

    return {
      totalProjects: projects.length,
      openTasks,
      doneTasks,
      totalTasks,
      dailyTaskCount: dailyRates.dailyTaskCount,
      dailyComplianceRate7d: dailyRates.rate7d,
      dailyComplianceRate30d: dailyRates.rate30d,
      totalMembers: memberCount,
      totalGuides: guideCount,
      totalPages: pageCount,
      completionRate,
      byAssignee,
      byStatus,
      projects: projectSummaries,
    };
  }
}
