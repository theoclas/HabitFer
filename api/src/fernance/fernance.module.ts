import { Module } from '@nestjs/common';
import {
  FernanceAccountsController,
  FernanceCategoriesController,
  FernanceCreditsController,
  FernanceExportController,
  FernanceIncomesController,
  FernanceInstallmentsController,
  FernanceMovementsController,
  FernanceQuickController,
  FernanceSummaryController,
  FernanceTransactionsController,
} from './fernance.controller';
import { FernanceAccountsService } from './fernance-accounts.service';
import { FernanceCategoriesService } from './fernance-categories.service';
import { FernanceCreditsService } from './fernance-credits.service';
import { FernanceIncomesService } from './fernance-incomes.service';
import { FernanceLedgerService } from './fernance-ledger.service';
import { FernanceMaintenanceService } from './fernance-maintenance.service';
import { FernanceQuickService } from './fernance-quick.service';
import { FernanceSummaryService } from './fernance-summary.service';
import { FernanceTransactionsService } from './fernance-transactions.service';
import { FinanceExportService } from './finance-export.service';

@Module({
  controllers: [
    FernanceAccountsController,
    FernanceIncomesController,
    FernanceCreditsController,
    FernanceInstallmentsController,
    FernanceSummaryController,
    FernanceTransactionsController,
    FernanceMovementsController,
    FernanceCategoriesController,
    FernanceQuickController,
    FernanceExportController,
  ],
  providers: [
    FernanceLedgerService,
    FernanceAccountsService,
    FernanceCategoriesService,
    FernanceIncomesService,
    FernanceCreditsService,
    FernanceTransactionsService,
    FernanceQuickService,
    FernanceSummaryService,
    FernanceMaintenanceService,
    FinanceExportService,
  ],
  exports: [FinanceExportService],
})
export class FernanceModule {}
