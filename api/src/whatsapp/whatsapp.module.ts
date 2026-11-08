import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { PushModule } from '../push/push.module';
import { WaClient } from './wa-client';
import { WhatsappRemindersService } from './whatsapp-reminders.service';
import { WhatsappController } from './whatsapp.controller';

@Module({
  imports: [PushModule],
  controllers: [WhatsappController],
  providers: [WaClient, WhatsappRemindersService, RolesGuard],
  exports: [WhatsappRemindersService],
})
export class WhatsappModule {}
