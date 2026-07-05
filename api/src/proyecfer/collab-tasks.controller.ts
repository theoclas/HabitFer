import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CollabTasksService } from './collab-tasks.service';
import { CreateCollabTaskDto, UpdateCollabTaskDto } from './dto/collab-task.dto';

@Controller('proyecfer')
@UseGuards(JwtAuthGuard)
export class CollabTasksController {
  constructor(private tasks: CollabTasksService) {}

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
}
