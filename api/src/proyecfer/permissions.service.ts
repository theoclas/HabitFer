import { ForbiddenException, Injectable } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_RANK: Record<WorkspaceRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getWorkspaceRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    return member?.role ?? null;
  }

  async requireWorkspaceRole(userId: string, workspaceId: string, min: WorkspaceRole) {
    const role = await this.getWorkspaceRole(userId, workspaceId);
    if (!role || ROLE_RANK[role] < ROLE_RANK[min]) {
      throw new ForbiddenException('Sin permiso en este workspace');
    }
    return role;
  }

  assertCanAssignRole(callerRole: WorkspaceRole, targetRole: WorkspaceRole) {
    if (ROLE_RANK[targetRole] > ROLE_RANK[callerRole]) {
      throw new ForbiddenException('No puedes asignar un rol superior al tuyo');
    }
    if (targetRole === WorkspaceRole.OWNER && callerRole !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('Solo un OWNER puede asignar rol OWNER');
    }
  }

  assertCanManageMember(callerRole: WorkspaceRole, targetMemberRole: WorkspaceRole) {
    if (ROLE_RANK[targetMemberRole] >= ROLE_RANK[callerRole]) {
      throw new ForbiddenException('No puedes modificar a un miembro con rol igual o superior');
    }
  }

  async requireProjectAccess(userId: string, projectId: string, min: WorkspaceRole = WorkspaceRole.VIEWER) {
    const project = await this.prisma.collabProject.findUnique({
      where: { id: projectId },
      include: { members: { where: { userId } } },
    });
    if (!project) throw new ForbiddenException('Proyecto no encontrado');

    const projectMember = project.members[0];
    if (projectMember && ROLE_RANK[projectMember.role] >= ROLE_RANK[min]) {
      return { project, role: projectMember.role };
    }

    const wsRole = await this.getWorkspaceRole(userId, project.workspaceId);
    if (!wsRole || ROLE_RANK[wsRole] < ROLE_RANK[min]) {
      throw new ForbiddenException('Sin permiso en este proyecto');
    }
    return { project, role: wsRole };
  }

  canEdit(role: WorkspaceRole) {
    return ROLE_RANK[role] >= ROLE_RANK[WorkspaceRole.EDITOR];
  }
}
