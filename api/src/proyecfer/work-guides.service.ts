import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { PermissionsService } from './permissions.service';

@Injectable()
export class WorkGuidesService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private activity: ActivityService,
  ) {}

  async listByProject(userId: string, projectId: string) {
    const { project } = await this.permissions.requireProjectAccess(userId, projectId);
    const guides = await this.prisma.workGuide.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { steps: true } },
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
    return guides.map((g) => ({
      id: g.id,
      workspaceId: g.workspaceId,
      projectId: g.projectId,
      title: g.title,
      description: g.description,
      icon: g.icon,
      category: g.category,
      published: g.published,
      stepCount: g._count.steps,
      createdBy: g.createdBy,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));
  }

  async create(
    userId: string,
    projectId: string,
    data: { title: string; description?: string; icon?: string; category?: string },
  ) {
    const { project } = await this.permissions.requireProjectAccess(userId, projectId, WorkspaceRole.EDITOR);
    const guide = await this.prisma.workGuide.create({
      data: {
        workspaceId: project.workspaceId,
        projectId,
        title: data.title.trim(),
        description: data.description?.trim(),
        icon: data.icon ?? '📋',
        category: data.category?.trim(),
        createdById: userId,
        steps: {
          create: {
            title: 'Paso 1 — Introduccion',
            summary: 'Describe el objetivo de este paso',
            sortOrder: 0,
          },
        },
      },
      include: {
        steps: { orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
    await this.activity.log({
      workspaceId: project.workspaceId,
      projectId,
      actorId: userId,
      action: ActivityAction.CREATED,
      targetType: 'work_guide',
      targetId: guide.id,
    });
    return guide;
  }

  async getOne(userId: string, guideId: string) {
    const guide = await this.prisma.workGuide.findUnique({
      where: { id: guideId },
      include: {
        steps: { orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { id: true, fullName: true, username: true } },
        project: { select: { id: true, name: true, color: true } },
      },
    });
    if (!guide) throw new NotFoundException('Guia no encontrada');
    await this.permissions.requireProjectAccess(userId, guide.projectId);
    return guide;
  }

  async update(
    userId: string,
    guideId: string,
    data: { title?: string; description?: string; icon?: string; category?: string; published?: boolean },
  ) {
    const guide = await this.requireGuide(userId, guideId, WorkspaceRole.EDITOR);
    return this.prisma.workGuide.update({
      where: { id: guideId },
      data: {
        title: data.title?.trim(),
        description: data.description?.trim(),
        icon: data.icon,
        category: data.category?.trim(),
        published: data.published,
      },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async remove(userId: string, guideId: string) {
    const guide = await this.requireGuide(userId, guideId, WorkspaceRole.EDITOR);
    await this.prisma.workGuide.delete({ where: { id: guideId } });
    await this.activity.log({
      workspaceId: guide.workspaceId,
      projectId: guide.projectId,
      actorId: userId,
      action: ActivityAction.DELETED,
      targetType: 'work_guide',
      targetId: guideId,
    });
    return { ok: true };
  }

  async addStep(
    userId: string,
    guideId: string,
    data: { title: string; summary?: string; content?: string; tips?: string; durationMin?: number },
  ) {
    const guide = await this.requireGuide(userId, guideId, WorkspaceRole.EDITOR);
    const maxOrder = await this.prisma.workGuideStep.aggregate({
      where: { guideId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    return this.prisma.workGuideStep.create({
      data: {
        guideId,
        title: data.title.trim(),
        summary: data.summary?.trim(),
        content: data.content?.trim(),
        tips: data.tips?.trim(),
        durationMin: data.durationMin,
        sortOrder,
      },
    });
  }

  async updateStep(
    userId: string,
    stepId: string,
    data: { title?: string; summary?: string; content?: string; tips?: string; durationMin?: number | null },
  ) {
    const step = await this.prisma.workGuideStep.findUnique({
      where: { id: stepId },
      include: { guide: true },
    });
    if (!step) throw new NotFoundException('Paso no encontrado');
    await this.permissions.requireProjectAccess(userId, step.guide.projectId, WorkspaceRole.EDITOR);
    return this.prisma.workGuideStep.update({
      where: { id: stepId },
      data: {
        title: data.title?.trim(),
        summary: data.summary?.trim(),
        content: data.content?.trim(),
        tips: data.tips?.trim(),
        durationMin: data.durationMin === null ? null : data.durationMin,
      },
    });
  }

  async removeStep(userId: string, stepId: string) {
    const step = await this.prisma.workGuideStep.findUnique({
      where: { id: stepId },
      include: { guide: true },
    });
    if (!step) throw new NotFoundException('Paso no encontrado');
    await this.permissions.requireProjectAccess(userId, step.guide.projectId, WorkspaceRole.EDITOR);
    await this.prisma.workGuideStep.delete({ where: { id: stepId } });
    return { ok: true };
  }

  async reorderSteps(userId: string, guideId: string, stepIds: string[]) {
    const guide = await this.requireGuide(userId, guideId, WorkspaceRole.EDITOR);
    await this.prisma.$transaction(
      stepIds.map((id, index) =>
        this.prisma.workGuideStep.update({
          where: { id, guideId: guide.id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.prisma.workGuideStep.findMany({ where: { guideId }, orderBy: { sortOrder: 'asc' } });
  }

  private async requireGuide(userId: string, guideId: string, min: WorkspaceRole = WorkspaceRole.VIEWER) {
    const guide = await this.prisma.workGuide.findUnique({ where: { id: guideId } });
    if (!guide) throw new NotFoundException('Guia no encontrada');
    await this.permissions.requireProjectAccess(userId, guide.projectId, min);
    return guide;
  }
}
