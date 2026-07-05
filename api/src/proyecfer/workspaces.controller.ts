import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { ActivityService } from './activity.service';
import { AddWorkspaceMemberDto, CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('proyecfer/workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(
    private workspaces: WorkspacesService,
    private activity: ActivityService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload) {
    return this.workspaces.listForUser(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() body: CreateWorkspaceDto) {
    return this.workspaces.create(user.userId, body);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.workspaces.getOne(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() body: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(user.userId, id, body);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() body: AddWorkspaceMemberDto,
  ) {
    return this.workspaces.addMember(user.userId, id, body.userId, body.role ?? WorkspaceRole.EDITOR);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.workspaces.removeMember(user.userId, id, targetUserId);
  }

  @Get(':id/users/search')
  searchUsers(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Query('q') q: string,
  ) {
    return this.workspaces.searchUsers(user.userId, id, q ?? '');
  }

  @Get(':id/stats')
  stats(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.workspaces.getStats(user.userId, id);
  }

  @Get(':id/activity')
  activityFeed(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.activity.list(user.userId, id, projectId);
  }
}
