import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUserPayload,
    @Query('projectId') projectId?: string,
    @Query('status') status?: TaskStatus,
  ) {
    return this.tasks.listTasks(user.userId, { projectId, status });
  }

  @Get('today')
  today(@CurrentUser() user: AuthUserPayload, @Query('date') date?: string) {
    return this.tasks.today(user.userId, date);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.tasks.getTask(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateTaskDto) {
    return this.tasks.createTask(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.updateTask(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.tasks.removeTask(user.userId, id);
  }
}
