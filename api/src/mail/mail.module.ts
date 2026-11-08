import { Module } from '@nestjs/common';
import { EmailRemindersController } from './email-reminders.controller';
import { EmailRemindersService } from './email-reminders.service';
import { MailService } from './mail.service';

@Module({
  controllers: [EmailRemindersController],
  providers: [MailService, EmailRemindersService],
  exports: [EmailRemindersService],
})
export class MailModule {}
