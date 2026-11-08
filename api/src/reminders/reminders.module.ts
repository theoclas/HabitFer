import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [PushModule, MailModule, WhatsappModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
