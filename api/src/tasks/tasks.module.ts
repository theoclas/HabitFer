import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [ProjectsController, TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
