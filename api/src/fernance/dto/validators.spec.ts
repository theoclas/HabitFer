import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateCreditDto,
  ListCreditsQuery,
  PayInstallmentDto,
} from './credit.dto';
import { CreateIncomeDto } from './income.dto';

async function messages<T extends object>(
  cls: new () => T,
  body: object,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('validaciones de FerFinance', () => {
  it('un ingreso válido pasa', async () => {
    expect(
      await messages(CreateIncomeDto, {
        accountId: 'a',
        amount: 1_500_000,
        date: '2026-11-09',
      }),
    ).toEqual([]);
  });

  it('fecha imposible, monto gigante y cuenta vacía dan mensajes claros', async () => {
    const m = await messages(CreateIncomeDto, {
      accountId: ' ',
      amount: 1e13,
      date: '2026-02-30',
    });
    expect(m).toEqual(
      expect.arrayContaining([
        'Elige una cuenta.',
        'El monto es demasiado grande.',
        'La fecha no es válida (usa AAAA-MM-DD y un día que exista).',
      ]),
    );
  });

  it('montos en cero o que no son números', async () => {
    expect(
      await messages(CreateIncomeDto, {
        accountId: 'a',
        amount: 0,
        date: '2026-11-09',
      }),
    ).toEqual(['El monto debe ser de al menos $ 1.']);
    expect(
      await messages(CreateIncomeDto, {
        accountId: 'a',
        amount: '1.500.000',
        date: '2026-11-09',
      }),
    ).toEqual(['El monto debe ser un número.']);
  });

  it('crédito: la primera cuota necesita una fecha real', async () => {
    const m = await messages(CreateCreditDto, {
      accountId: 'a',
      name: 'Moto',
      totalAmount: 1000,
      installmentAmount: 100,
      firstDueDate: '2026-04-31',
    });
    expect(m).toEqual(['La fecha de la primera cuota no es válida.']);
  });

  it('un estado mal escrito en la consulta es un error claro, no un 500', async () => {
    expect(await messages(ListCreditsQuery, { status: 'FOO' })).toEqual([
      'El estado no es válido (ACTIVE, PAID_OFF o CANCELLED).',
    ]);
  });

  it('pagar sin datos es válido (hoy, el valor de la cuota y la cuenta del crédito)', async () => {
    expect(await messages(PayInstallmentDto, {})).toEqual([]);
    expect(
      await messages(PayInstallmentDto, {
        paidDate: '2026-11-03',
        paidAmount: 310_000,
        accountId: 'b',
      }),
    ).toEqual([]);
  });
});
