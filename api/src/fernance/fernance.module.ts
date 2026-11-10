import { Module } from '@nestjs/common';
import {
  FernanceAccountsController,
  FernanceCreditsController,
  FernanceExportController,
  FernanceIncomesController,
  FernanceInstallmentsController,
  FernanceSummaryController,
} from './fernance.controller';
import { FernanceAccountsService } from './fernance-accounts.service';
import { FernanceCreditsService } from './fernance-credits.service';
import { FernanceIncomesService } from './fernance-incomes.service';
import { FernanceMaintenanceService } from './fernance-maintenance.service';
import { FernanceSummaryService } from './fernance-summary.service';
import { FinanceExportService } from './finance-export.service';

@Module({
  controllers: [
    FernanceAccountsController,
    FernanceIncomesController,
    FernanceCreditsController,
    FernanceInstallmentsController,
    FernanceSummaryController,
    FernanceExportController,
  ],
  providers: [
    FernanceAccountsService,
    FernanceIncomesService,
    FernanceCreditsService,
    FernanceSummaryService,
    FernanceMaintenanceService,
    FinanceExportService,
  ],
  exports: [FinanceExportService],
})
export class FernanceModule {}
