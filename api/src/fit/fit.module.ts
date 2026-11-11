import { Module } from '@nestjs/common';
import { FitPlanService } from './fit-plan.service';
import { FitController } from './fit.controller';
import { FitService } from './fit.service';

/** FerFit: ejercicio en casa. */
@Module({
  controllers: [FitController],
  providers: [FitService, FitPlanService],
  exports: [FitService, FitPlanService],
})
export class FitModule {}
