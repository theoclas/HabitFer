import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, BlockType, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PagesService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private activity: ActivityService,
  ) {}

  async list(userId: string, workspaceId: string, projectId?: string) {
    await this.permissions.requireWorkspaceRole(userId, workspaceId, WorkspaceRole.VIEWER);
    return this.prisma.page.findMany({
      where: { workspaceId, projectId: projectId ?? undefined },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(
    userId: string,
    workspaceId: string,
    data: { title: string; projectId?: string; parentPageId?: string; icon?: string },
  ) {
    await this.permissions.requireWorkspaceRole(userId, workspaceId, WorkspaceRole.EDITOR);
    if (data.projectId) await this.permissions.requireProjectAccess(userId, data.projectId, WorkspaceRole.EDITOR);

    const page = await this.prisma.page.create({
      data: {
        workspaceId,
        projectId: data.projectId,
        parentPageId: data.parentPageId,
        title: data.title.trim(),
        icon: data.icon,
        blocks: {
          create: { type: BlockType.paragraph, content: { text: '' }, sortOrder: 0 },
        },
      },
      include: { blocks: true },
    });
    await this.activity.log({
      workspaceId,
      projectId: data.projectId,
      actorId: userId,
      action: ActivityAction.CREATED,
      targetType: 'page',
      targetId: page.id,
    });
    return page;
  }

  async getOne(userId: string, pageId: string) {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' } },
        childPages: { orderBy: { sortOrder: 'asc' } },
        database: { include: { properties: true, views: true } },
      },
    });
    if (!page) throw new NotFoundException('Pagina no encontrada');
    await this.permissions.requireWorkspaceRole(userId, page.workspaceId, WorkspaceRole.VIEWER);
    return page;
  }

  async update(userId: string, pageId: string, data: { title?: string; icon?: string; coverUrl?: string }) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('Pagina no encontrada');
    await this.permissions.requireWorkspaceRole(userId, page.workspaceId, WorkspaceRole.EDITOR);
    return this.prisma.page.update({
      where: { id: pageId },
      data: { title: data.title?.trim(), icon: data.icon, coverUrl: data.coverUrl },
    });
  }
}

@Injectable()
export class BlocksService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  async upsertBatch(userId: string, pageId: string, blocks: { id?: string; type: BlockType; content: object; sortOrder: number; parentBlockId?: string }[]) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('Pagina no encontrada');
    await this.permissions.requireWorkspaceRole(userId, page.workspaceId, WorkspaceRole.EDITOR);

    await this.prisma.block.deleteMany({ where: { pageId } });
    await this.prisma.block.createMany({
      data: blocks.map((b) => ({
        pageId,
        type: b.type,
        content: b.content,
        sortOrder: b.sortOrder,
        parentBlockId: b.parentBlockId,
      })),
    });
    return this.prisma.block.findMany({ where: { pageId }, orderBy: { sortOrder: 'asc' } });
  }
}
