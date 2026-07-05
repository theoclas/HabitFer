import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { TasksService } from './tasks.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload) {
    return this.tasks.listProjects(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateProjectDto) {
    return this.tasks.createProject(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.tasks.updateProject(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.tasks.removeProject(user.userId, id);
  }
}
