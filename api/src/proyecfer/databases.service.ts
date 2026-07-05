import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityAction,
  DatabasePropertyType,
  DatabaseViewType,
  Prisma,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { PermissionsService } from './permissions.service';

@Injectable()
export class DatabasesService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private activity: ActivityService,
  ) {}

  async create(userId: string, pageId: string, title: string) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('Pagina no encontrada');
    await this.permissions.requireWorkspaceRole(userId, page.workspaceId, WorkspaceRole.EDITOR);

    const db = await this.prisma.database.create({
      data: {
        pageId,
        title: title.trim(),
        properties: {
          create: [
            { name: 'Nombre', type: DatabasePropertyType.TEXT, sortOrder: 0 },
            { name: 'Estado', type: DatabasePropertyType.SELECT, sortOrder: 1, config: { options: ['Por hacer', 'En progreso', 'Hecho'] } },
            { name: 'Fecha', type: DatabasePropertyType.DATE, sortOrder: 2 },
          ],
        },
        views: {
          create: [
            { name: 'Tabla', type: DatabaseViewType.TABLE, sortOrder: 0, config: {} },
            { name: 'Tablero', type: DatabaseViewType.BOARD, sortOrder: 1, config: { groupBy: 'Estado' } },
            { name: 'Calendario', type: DatabaseViewType.CALENDAR, sortOrder: 2, config: { dateProperty: 'Fecha' } },
          ],
        },
      },
      include: { properties: true, views: true },
    });
    await this.activity.log({
      workspaceId: page.workspaceId,
      projectId: page.projectId ?? undefined,
      actorId: userId,
      action: ActivityAction.CREATED,
      targetType: 'database',
      targetId: db.id,
    });
    return db;
  }

  async getOne(userId: string, databaseId: string) {
    const db = await this.prisma.database.findUnique({
      where: { id: databaseId },
      include: {
        page: true,
        properties: { orderBy: { sortOrder: 'asc' } },
        views: { orderBy: { sortOrder: 'asc' } },
        rows: {
          orderBy: { sortOrder: 'asc' },
          include: { page: { select: { id: true, title: true, icon: true } } },
        },
      },
    });
    if (!db) throw new NotFoundException('Base de datos no encontrada');
    await this.permissions.requireWorkspaceRole(userId, db.page.workspaceId, WorkspaceRole.VIEWER);
    return db;
  }

  async addRow(userId: string, databaseId: string, title: string, values?: Record<string, unknown>) {
    const db = await this.prisma.database.findUnique({
      where: { id: databaseId },
      include: { page: true },
    });
    if (!db) throw new NotFoundException('Base de datos no encontrada');
    await this.permissions.requireWorkspaceRole(userId, db.page.workspaceId, WorkspaceRole.EDITOR);

    const properties = await this.prisma.databaseProperty.findMany({
      where: { databaseId },
      orderBy: { sortOrder: 'asc' },
    });
    const defaultValues: Record<string, unknown> = { ...values };
    for (const prop of properties) {
      if (defaultValues[prop.id] !== undefined) continue;
      if (prop.name === 'Nombre') defaultValues[prop.id] = title;
      if (prop.name === 'Estado') defaultValues[prop.id] = 'Por hacer';
    }

    const rowPage = await this.prisma.page.create({
      data: {
        workspaceId: db.page.workspaceId,
        projectId: db.page.projectId,
        title: title.trim(),
      },
    });

    return this.prisma.databaseRow.create({
      data: {
        databaseId,
        pageId: rowPage.id,
        values: (values ?? defaultValues) as Prisma.InputJsonValue,
      },
      include: { page: true },
    });
  }

  async updateRow(userId: string, rowId: string, values: Record<string, unknown>, title?: string) {
    const row = await this.prisma.databaseRow.findUnique({
      where: { id: rowId },
      include: { database: { include: { page: true } }, page: true },
    });
    if (!row) throw new NotFoundException('Fila no encontrada');
    await this.permissions.requireWorkspaceRole(userId, row.database.page.workspaceId, WorkspaceRole.EDITOR);

    if (title) {
      await this.prisma.page.update({ where: { id: row.pageId }, data: { title: title.trim() } });
    }
    return this.prisma.databaseRow.update({
      where: { id: rowId },
      data: { values: values as Prisma.InputJsonValue },
      include: { page: true },
    });
  }
}
