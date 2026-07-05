import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { PermissionsService } from './permissions.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let permissions: PermissionsService;

  const prisma = {
    activityLog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        PermissionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ActivityService);
    permissions = module.get(PermissionsService);
    jest.spyOn(permissions, 'requireWorkspaceRole').mockResolvedValue(WorkspaceRole.VIEWER);
  });

  it('requires workspace membership before listing activity', async () => {
    jest.spyOn(permissions, 'requireWorkspaceRole').mockRejectedValue(new ForbiddenException());

    await expect(service.list('user-1', 'ws-1')).rejects.toThrow(ForbiddenException);
    expect(prisma.activityLog.findMany).not.toHaveBeenCalled();
  });

  it('lists activity when user has access', async () => {
    await service.list('user-1', 'ws-1');
    expect(permissions.requireWorkspaceRole).toHaveBeenCalledWith('user-1', 'ws-1', WorkspaceRole.VIEWER);
    expect(prisma.activityLog.findMany).toHaveBeenCalled();
  });
});
