import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CollabComplianceService } from './collab-compliance.service';
import { CollabProjectsService } from './collab-projects.service';
import { CreateCollabProjectDto, UpdateCollabProjectDto } from './dto/collab-project.dto';

@Controller('proyecfer')
@UseGuards(JwtAuthGuard)
export class CollabProjectsController {
  constructor(
    private projects: CollabProjectsService,
    private compliance: CollabComplianceService,
  ) {}

  @Get('workspaces/:workspaceId/projects')
  list(@CurrentUser() user: AuthUserPayload, @Param('workspaceId') workspaceId: string) {
    return this.projects.list(user.userId, workspaceId);
  }

  @Post('workspaces/:workspaceId/projects')
  create(
    @CurrentUser() user: AuthUserPayload,
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateCollabProjectDto,
  ) {
    return this.projects.create(user.userId, workspaceId, body);
  }

  @Get('projects/:projectId')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('projectId') projectId: string) {
    return this.projects.getOne(user.userId, projectId);
  }

  @Patch('projects/:projectId')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('projectId') projectId: string,
    @Body() body: UpdateCollabProjectDto,
  ) {
    return this.projects.update(user.userId, projectId, body);
  }

  @Get('projects/:projectId/compliance')
  complianceReport(
    @CurrentUser() user: AuthUserPayload,
    @Param('projectId') projectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return this.compliance.getProjectCompliance(user.userId, projectId, from, to, assigneeId);
  }

  @Get('projects/:projectId/daily-tasks')
  dailyTasks(
    @CurrentUser() user: AuthUserPayload,
    @Param('projectId') projectId: string,
    @Query('date') date?: string,
  ) {
    return this.compliance.listDailyTasksForDate(user.userId, projectId, date);
  }
}
