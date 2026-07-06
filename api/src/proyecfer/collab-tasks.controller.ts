import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CollabComplianceService } from './collab-compliance.service';
import { CollabTasksService } from './collab-tasks.service';
import { CreateCollabTaskDto, UpdateCollabTaskDto } from './dto/collab-task.dto';
import { CompleteDailyTaskDto } from './dto/complete-daily-task.dto';

@Controller('proyecfer')
@UseGuards(JwtAuthGuard)
export class CollabTasksController {
  constructor(
    private tasks: CollabTasksService,
    private compliance: CollabComplianceService,
  ) {}

  @Post('projects/:projectId/tasks')
  create(
    @CurrentUser() user: AuthUserPayload,
    @Param('projectId') projectId: string,
    @Body() body: CreateCollabTaskDto,
  ) {
    return this.tasks.create(user.userId, projectId, body);
  }

  @Patch('tasks/:taskId')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('taskId') taskId: string,
    @Body() body: UpdateCollabTaskDto,
  ) {
    return this.tasks.update(user.userId, taskId, body);
  }

  @Delete('tasks/:taskId')
  remove(@CurrentUser() user: AuthUserPayload, @Param('taskId') taskId: string) {
    return this.tasks.remove(user.userId, taskId);
  }

  @Post('tasks/:taskId/complete')
  complete(
    @CurrentUser() user: AuthUserPayload,
    @Param('taskId') taskId: string,
    @Body() body: CompleteDailyTaskDto,
  ) {
    return this.compliance.complete(user.userId, taskId, body.date);
  }

  @Delete('tasks/:taskId/complete/:date')
  uncomplete(
    @CurrentUser() user: AuthUserPayload,
    @Param('taskId') taskId: string,
    @Param('date') date: string,
  ) {
    return this.compliance.uncomplete(user.userId, taskId, date);
  }
}
