import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';

@Module({
  imports: [PushModule, MailModule, WhatsappModule],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
