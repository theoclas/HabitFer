import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreditStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CreateFinanceAccountDto, UpdateFinanceAccountDto } from './dto/account.dto';
import { CreateCreditDto, UpdateCreditDto } from './dto/credit.dto';
import { CreateIncomeDto, UpdateIncomeDto } from './dto/income.dto';
import { FernanceAccountsService } from './fernance-accounts.service';
import { FernanceCreditsService } from './fernance-credits.service';
import { FernanceIncomesService } from './fernance-incomes.service';
import { FernanceSummaryService } from './fernance-summary.service';

@Controller('fernance/accounts')
@UseGuards(JwtAuthGuard)
export class FernanceAccountsController {
  constructor(private accounts: FernanceAccountsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload) {
    return this.accounts.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateFinanceAccountDto) {
    return this.accounts.create(user.userId, dto);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.accounts.getOne(user.userId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: UpdateFinanceAccountDto) {
    return this.accounts.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.accounts.remove(user.userId, id);
  }
}

@Controller('fernance/incomes')
@UseGuards(JwtAuthGuard)
export class FernanceIncomesController {
  constructor(private incomes: FernanceIncomesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUserPayload,
    @Query('accountId') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.incomes.list(user.userId, accountId, from, to);
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateIncomeDto) {
    return this.incomes.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: UpdateIncomeDto) {
    return this.incomes.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.incomes.remove(user.userId, id);
  }
}

@Controller('fernance/credits')
@UseGuards(JwtAuthGuard)
export class FernanceCreditsController {
  constructor(private credits: FernanceCreditsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUserPayload,
    @Query('accountId') accountId?: string,
    @Query('status') status?: CreditStatus,
  ) {
    return this.credits.list(user.userId, accountId, status);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.credits.getOne(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateCreditDto) {
    return this.credits.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: UpdateCreditDto) {
    return this.credits.update(user.userId, id, dto);
  }
}

@Controller('fernance/installments')
@UseGuards(JwtAuthGuard)
export class FernanceInstallmentsController {
  constructor(private credits: FernanceCreditsService) {}

  @Patch(':id/pay')
  pay(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.credits.payInstallment(user.userId, id);
  }

  @Patch(':id/unpay')
  unpay(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.credits.unpayInstallment(user.userId, id);
  }
}

@Controller('fernance/summary')
@UseGuards(JwtAuthGuard)
export class FernanceSummaryController {
  constructor(private summary: FernanceSummaryService) {}

  @Get()
  get(
    @CurrentUser() user: AuthUserPayload,
    @Query('accountId') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.summary.getSummary(user.userId, accountId, from, to);
  }
}
