import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HabitsModule } from '../habits/habits.module';
import { TasksModule } from '../tasks/tasks.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [AuthModule, HabitsModule, TasksModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
