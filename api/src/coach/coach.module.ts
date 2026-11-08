import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';

@Module({
  imports: [PushModule],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
