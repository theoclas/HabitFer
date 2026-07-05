import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, CollabNotificationType, CommentTargetType, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { CollabNotificationsService } from './notifications.service';
import { PermissionsService } from './permissions.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private activity: ActivityService,
    private notifications: CollabNotificationsService,
  ) {}

  async list(targetType: CommentTargetType, targetId: string, userId: string) {
    await this.ensureAccess(userId, targetType, targetId);
    return this.prisma.comment.findMany({
      where: { targetType, targetId, parentCommentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, username: true, fullName: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, username: true, fullName: true } } },
        },
      },
    });
  }

  async create(
    userId: string,
    data: { targetType: CommentTargetType; targetId: string; body: string; parentCommentId?: string },
  ) {
    const ctx = await this.ensureAccess(userId, data.targetType, data.targetId, WorkspaceRole.EDITOR);

    if (data.parentCommentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: data.parentCommentId } });
      if (!parent || parent.targetType !== data.targetType || parent.targetId !== data.targetId) {
        throw new NotFoundException('Comentario padre invalido');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        targetType: data.targetType,
        targetId: data.targetId,
        body: data.body.trim(),
        authorId: userId,
        parentCommentId: data.parentCommentId,
      },
      include: { author: { select: { id: true, username: true, fullName: true } } },
    });
    await this.activity.log({
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      actorId: userId,
      action: ActivityAction.COMMENTED,
      targetType: data.targetType,
      targetId: data.targetId,
    });

    const mentioned = await this.notifications.parseMentions(data.body, ctx.workspaceId);
    for (const user of mentioned) {
      if (user.id === userId) continue;
      await this.notifications.notify(
        user.id,
        CollabNotificationType.COMMENT_MENTION,
        'Te mencionaron en un comentario',
        data.body.slice(0, 200),
        { targetType: data.targetType, targetId: data.targetId },
      );
    }

    return comment;
  }

  private async ensureAccess(
    userId: string,
    targetType: CommentTargetType,
    targetId: string,
    min: WorkspaceRole = WorkspaceRole.VIEWER,
  ) {
    if (targetType === CommentTargetType.COLLAB_TASK) {
      const task = await this.prisma.collabTask.findUnique({ where: { id: targetId } });
      if (!task) throw new NotFoundException('Tarea no encontrada');
      await this.permissions.requireProjectAccess(userId, task.projectId, min);
      return { workspaceId: task.workspaceId, projectId: task.projectId };
    }
    if (targetType === CommentTargetType.COLLAB_PROJECT) {
      const { project } = await this.permissions.requireProjectAccess(userId, targetId, min);
      return { workspaceId: project.workspaceId, projectId: project.id };
    }
    if (targetType === CommentTargetType.WORK_GUIDE) {
      const guide = await this.prisma.workGuide.findUnique({ where: { id: targetId } });
      if (!guide) throw new NotFoundException('Guia no encontrada');
      await this.permissions.requireProjectAccess(userId, guide.projectId, min);
      return { workspaceId: guide.workspaceId, projectId: guide.projectId };
    }
    const page = await this.prisma.page.findUnique({ where: { id: targetId } });
    if (!page) throw new NotFoundException('Pagina no encontrada');
    await this.permissions.requireWorkspaceRole(userId, page.workspaceId, min);
    return { workspaceId: page.workspaceId, projectId: page.projectId ?? undefined };
  }
}
