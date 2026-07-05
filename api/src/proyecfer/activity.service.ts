import { Injectable } from '@nestjs/common';
import { ActivityAction, Prisma, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';

@Injectable()
export class ActivityService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  async log(params: {
    workspaceId: string;
    projectId?: string;
    actorId: string;
    action: ActivityAction;
    targetType?: string;
    targetId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.activityLog.create({
      data: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata ?? {},
      },
      include: {
        actor: { select: { id: true, username: true, fullName: true } },
      },
    });
  }

  async list(userId: string, workspaceId: string, projectId?: string, limit = 50) {
    await this.permissions.requireWorkspaceRole(userId, workspaceId, WorkspaceRole.VIEWER);
    return this.prisma.activityLog.findMany({
      where: { workspaceId, projectId: projectId ?? undefined },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { id: true, username: true, fullName: true } },
      },
    });
  }
}
