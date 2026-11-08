import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';

@Module({
  imports: [PushModule, MailModule],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
