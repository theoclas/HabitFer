import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

w("api/src/tasks/tasks.service.ts", `import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task, TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { isDueToday, isOverdue, parseDateKey, startOfDay, toDateKey } from './tasks.utils';

type TaskWithProject = Task & { project: { id: string; name: string; color: string } | null };

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  // --- Projects ---
  async listProjects(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { userId, archived: false },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { tasks: { where: { status: { not: TaskStatus.DONE } } } } } },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      sortOrder: p.sortOrder,
      archived: p.archived,
      openTasks: p._count.tasks,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async createProject(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: { userId, name: dto.name.trim(), color: dto.color ?? '#38bdf8' },
    });
    return project;
  }

  async updateProject(userId: string, id: string, dto: UpdateProjectDto) {
    await this.ensureProjectOwner(userId, id);
    return this.prisma.project.update({
      where: { id },
      data: { name: dto.name?.trim(), color: dto.color, archived: dto.archived },
    });
  }

  async removeProject(userId: string, id: string) {
    await this.ensureProjectOwner(userId, id);
    await this.prisma.project.delete({ where: { id } });
    return { ok: true };
  }

  // --- Tasks ---
  async listTasks(userId: string, filters: { projectId?: string; status?: TaskStatus }) {
    const where: Prisma.TaskWhereInput = {
      userId,
      status: filters.status,
      projectId: filters.projectId === 'inbox' ? null : filters.projectId,
    };

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      include: { project: { select: { id: true, name: true, color: true } } },
    });

    return tasks.map((t) => this.toTaskView(t));
  }

  async today(userId: string, dateKey?: string) {
    const ref = dateKey ? parseDateKey(dateKey) : startOfDay(new Date());
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        status: { not: TaskStatus.DONE },
        OR: [{ dueDate: { lte: ref } }, { dueDate: null, createdAt: { gte: addDays(ref, -7) } }],
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
      include: { project: { select: { id: true, name: true, color: true } } },
    });

    return tasks
      .filter((t) => !t.dueDate || toDateKey(t.dueDate) <= toDateKey(ref))
      .map((t) => this.toTaskView(t, ref));
  }

  async getTask(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: { project: { select: { id: true, name: true, color: true } } },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return this.toTaskView(task);
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    if (dto.projectId) await this.ensureProjectOwner(userId, dto.projectId);
    const task = await this.prisma.task.create({
      data: {
        userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        projectId: dto.projectId || null,
        status: dto.status ?? TaskStatus.TODO,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        dueDate: dto.dueDate ? parseDateKey(dto.dueDate) : null,
        dueTime: dto.dueTime ?? null,
        reminderEnabled: dto.reminderEnabled ?? false,
      },
      include: { project: { select: { id: true, name: true, color: true } } },
    });
    return this.toTaskView(task);
  }

  async updateTask(userId: string, id: string, dto: UpdateTaskDto) {
    await this.ensureTaskOwner(userId, id);
    if (dto.projectId) await this.ensureProjectOwner(userId, dto.projectId);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        projectId: dto.projectId === undefined ? undefined : dto.projectId || null,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? parseDateKey(dto.dueDate) : null,
        dueTime: dto.dueTime === undefined ? undefined : dto.dueTime,
        reminderEnabled: dto.reminderEnabled,
      },
      include: { project: { select: { id: true, name: true, color: true } } },
    });
    return this.toTaskView(task);
  }

  async removeTask(userId: string, id: string) {
    await this.ensureTaskOwner(userId, id);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }

  private toTaskView(task: TaskWithProject, ref = startOfDay(new Date())) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      project: task.project,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? toDateKey(task.dueDate) : null,
      dueTime: task.dueTime,
      reminderEnabled: task.reminderEnabled,
      sortOrder: task.sortOrder,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      overdue: isOverdue(task.dueDate, task.status, ref),
      dueToday: isDueToday(task.dueDate, ref),
    };
  }

  private async ensureProjectOwner(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, userId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  private async ensureTaskOwner(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return task;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
`);

w("api/src/tasks/projects.controller.ts", `import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
`);

w("api/src/tasks/tasks.controller.ts", `import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
`);

w("api/src/tasks/tasks.module.ts", `import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [ProjectsController, TasksController],
  providers: [TasksService],
})
export class TasksModule {}
`);

w("api/src/app.module.ts", `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HabitsModule } from './habits/habits.module';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, HabitsModule, TasksModule],
})
export class AppModule {}
`);

console.log("tasks service + controllers ok");
