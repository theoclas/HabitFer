import { Injectable } from '@nestjs/common';
import { CollabNotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollabNotificationsService {
  constructor(private prisma: PrismaService) {}

  async notify(userId: string, type: CollabNotificationType, title: string, body?: string, metadata?: object) {
    if (!userId) return;
    return this.prisma.collabNotification.create({
      data: { userId, type, title, body, metadata: metadata ?? {} },
    });
  }

  async listForUser(userId: string, unreadOnly = false) {
    return this.prisma.collabNotification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.collabNotification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.collabNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async parseMentions(body: string, workspaceId: string) {
    const matches = body.match(/@([a-zA-Z0-9_]+)/g) ?? [];
    const usernames = [...new Set(matches.map((m) => m.slice(1)))];
    if (usernames.length === 0) return [];

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, user: { username: { in: usernames } } },
      include: { user: { select: { id: true, username: true } } },
    });
    return members.map((m) => m.user);
  }
}
