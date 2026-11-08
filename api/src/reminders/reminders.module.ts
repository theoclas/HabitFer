import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [PushModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
