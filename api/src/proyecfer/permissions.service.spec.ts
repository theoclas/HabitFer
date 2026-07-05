import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  const prisma = {
    workspaceMember: {
      findUnique: jest.fn(),
    },
    collabProject: {
      findUnique: jest.fn(),
    },
  };

  const service = new PermissionsService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('allows owner-level access when role is sufficient', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: WorkspaceRole.OWNER });
    await expect(service.requireWorkspaceRole('u1', 'w1', WorkspaceRole.EDITOR)).resolves.toBe(
      WorkspaceRole.OWNER,
    );
  });

  it('denies viewer when editor is required', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: WorkspaceRole.VIEWER });
    await expect(service.requireWorkspaceRole('u1', 'w1', WorkspaceRole.EDITOR)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('canEdit returns true for editor and above', () => {
    expect(service.canEdit(WorkspaceRole.EDITOR)).toBe(true);
    expect(service.canEdit(WorkspaceRole.VIEWER)).toBe(false);
  });
});
