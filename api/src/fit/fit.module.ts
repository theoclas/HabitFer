import { Module } from '@nestjs/common';
import { FitController } from './fit.controller';
import { FitService } from './fit.service';

/** FerFit: ejercicio en casa. */
@Module({
  controllers: [FitController],
  providers: [FitService],
  exports: [FitService],
})
export class FitModule {}
