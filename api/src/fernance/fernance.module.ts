import { Module } from '@nestjs/common';
import {
  FernanceAccountsController,
  FernanceCreditsController,
  FernanceIncomesController,
  FernanceInstallmentsController,
  FernanceSummaryController,
} from './fernance.controller';
import { FernanceAccountsService } from './fernance-accounts.service';
import { FernanceCreditsService } from './fernance-credits.service';
import { FernanceIncomesService } from './fernance-incomes.service';
import { FernanceSummaryService } from './fernance-summary.service';

@Module({
  controllers: [
    FernanceAccountsController,
    FernanceIncomesController,
    FernanceCreditsController,
    FernanceInstallmentsController,
    FernanceSummaryController,
  ],
  providers: [
    FernanceAccountsService,
    FernanceIncomesService,
    FernanceCreditsService,
    FernanceSummaryService,
  ],
})
export class FernanceModule {}
