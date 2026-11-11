import { Module } from '@nestjs/common';
import { FitModule } from '../fit/fit.module';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [PushModule, MailModule, WhatsappModule, FitModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
