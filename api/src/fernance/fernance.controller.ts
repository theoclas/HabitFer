import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { localTodayKey } from '../common/date.utils';
import {
  CurrentUser,
  type AuthUserPayload,
} from '../common/decorators/current-user.decorator';
import {
  CreateFinanceAccountDto,
  ListAccountsQuery,
  UpdateFinanceAccountDto,
} from './dto/account.dto';
import {
  CreateCreditDto,
  ListCreditsQuery,
  PayInstallmentDto,
  ReplanCreditDto,
  SummaryQuery,
  UpdateCreditDto,
  UpdateInstallmentDto,
} from './dto/credit.dto';
import {
  CreateIncomeDto,
  ListIncomesQuery,
  UpdateIncomeDto,
} from './dto/income.dto';
import { FernanceAccountsService } from './fernance-accounts.service';
import { FernanceCreditsService } from './fernance-credits.service';
import { FernanceIncomesService } from './fernance-incomes.service';
import { FernanceSummaryService } from './fernance-summary.service';
import { FinanceExportService } from './finance-export.service';

@Controller('fernance/accounts')
@UseGuards(JwtAuthGuard)
export class FernanceAccountsController {
  constructor(private accounts: FernanceAccountsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUserPayload,
    @Query() query: ListAccountsQuery,
  ) {
    return this.accounts.list(user.userId, query.archivadas === '1');
  }

  @Post()
  create(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateFinanceAccountDto,
  ) {
    return this.accounts.create(user.userId, dto);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.accounts.getOne(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateFinanceAccountDto,
  ) {
    return this.accounts.update(user.userId, id, dto);
  }

  /** Manda la cuenta a la papelera (se puede restaurar). */
  @Delete(':id')
  archive(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.accounts.archive(user.userId, id);
  }

  @Post(':id/restore')
  restore(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.accounts.restore(user.userId, id);
  }

  /** Borra para siempre una cuenta archivada, con sus ingresos y créditos. */
  @Delete(':id/permanent')
  purge(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.accounts.purge(user.userId, id);
  }
}

@Controller('fernance/incomes')
@UseGuards(JwtAuthGuard)
export class FernanceIncomesController {
  constructor(private incomes: FernanceIncomesService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload, @Query() query: ListIncomesQuery) {
    return this.incomes.list(
      user.userId,
      query.accountId,
      query.from,
      query.to,
    );
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateIncomeDto) {
    return this.incomes.create(user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateIncomeDto,
  ) {
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
  list(@CurrentUser() user: AuthUserPayload, @Query() query: ListCreditsQuery) {
    return this.credits.list(user.userId, query.accountId, query.status);
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
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCreditDto,
  ) {
    return this.credits.update(user.userId, id, dto);
  }

  /** Rehace las cuotas que faltan (las pagadas no se tocan). */
  @Put(':id/plan')
  replan(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: ReplanCreditDto,
  ) {
    return this.credits.replan(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.credits.remove(user.userId, id);
  }
}

@Controller('fernance/installments')
@UseGuards(JwtAuthGuard)
export class FernanceInstallmentsController {
  constructor(private credits: FernanceCreditsService) {}

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateInstallmentDto,
  ) {
    return this.credits.updateInstallment(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.credits.removeInstallment(user.userId, id);
  }

  /** Marca pagada con el día, el valor y la cuenta reales (o cambia los datos de un pago). */
  @Patch(':id/pay')
  pay(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: PayInstallmentDto,
  ) {
    return this.credits.payInstallment(user.userId, id, dto);
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
  get(@CurrentUser() user: AuthUserPayload, @Query() query: SummaryQuery) {
    return this.summary.getSummary(
      user.userId,
      query.accountId,
      query.from,
      query.to,
    );
  }
}

@Controller('fernance/export')
@UseGuards(JwtAuthGuard)
export class FernanceExportController {
  constructor(private exporter: FinanceExportService) {}

  /** Respaldo de FerFinance en JSON (se descarga como archivo). */
  @Get()
  json(
    @CurrentUser() user: AuthUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ferfinance-respaldo-${localTodayKey()}.json"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    return this.exporter.exportJson(user.userId);
  }

  /** Movimientos en CSV para Excel. */
  @Get('csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  csv(
    @CurrentUser() user: AuthUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ferfinance-movimientos-${localTodayKey()}.csv"`,
    );
    return this.exporter.exportCsv(user.userId);
  }

  /** Importa un respaldo: suma lo que falta, nunca borra ni cambia lo que ya hay. */
  @Post('import')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  import(@CurrentUser() user: AuthUserPayload, @Body() body: unknown) {
    return this.exporter.importJson(user.userId, body);
  }
}
