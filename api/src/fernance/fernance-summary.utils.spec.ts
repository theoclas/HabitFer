import type { MovementLookups, MovementTx } from './fernance-movements.utils';
import {
  buildSummary,
  type SummaryCredit,
  type SummaryInstallment,
} from './fernance-summary.utils';

const lookups: MovementLookups = {
  accounts: new Map([
    ['per', { name: 'Personal', color: null }],
    ['neg', { name: 'Negocio', color: null }],
    ['nequi', { name: 'Nequi', color: null }],
  ]),
  categories: new Map([['comida', { name: 'Comida afuera', icon: '🍽️' }]]),
};

const inst = (
  id: string,
  dueKey: string,
  amount: number,
  extra: Partial<SummaryInstallment> = {},
): SummaryInstallment => ({
  id,
  dueKey,
  amount,
  status: 'PENDING',
  paidKey: null,
  paidAmount: null,
  paidAccountId: null,
  ...extra,
});

const credit = (
  id: string,
  installments: SummaryInstallment[],
  extra: Partial<SummaryCredit> = {},
): SummaryCredit => ({
  id,
  name: id === 'tv' ? 'Televisor' : 'Moto',
  accountId: 'per',
  status: 'ACTIVE',
  installments,
  ...extra,
});

const tx = (
  id: string,
  type: MovementTx['type'],
  dateKey: string,
  amount: number,
  accountId: string,
  extra: Partial<MovementTx> = {},
): MovementTx => ({
  id,
  type,
  dateKey,
  amount,
  accountId,
  toAccountId: null,
  categoryId: null,
  merchant: null,
  note: null,
  source: 'MANUAL',
  needsReview: false,
  createdAt: `${dateKey}T12:00:00.000Z`,
  ...extra,
});

const NOV = { from: '2026-11-01', to: '2026-11-30' };
const ALL = new Set(['per', 'neg', 'nequi']);
const base = {
  todayKey: '2026-11-09',
  scope: ALL,
  accountId: null,
  book: null,
  lookups,
  transactions: [] as MovementTx[],
};

describe('buildSummary', () => {
  it('una cuota vencida del mes pasado sale como vencida y cuenta en comprometido', () => {
    const s = buildSummary({
      ...base,
      range: NOV,
      credits: [
        credit('tv', [
          inst('o', '2026-10-31', 300_000),
          inst('n', '2026-11-30', 300_000),
        ]),
      ],
    });
    expect(s.totals.overdue).toBe(300_000);
    expect(s.totals.committed).toBe(600_000);
    expect(s.overdue).toEqual([
      expect.objectContaining({
        id: 'o',
        daysLate: 9,
        creditName: 'Televisor',
      }),
    ]);
    expect(s.movements.map((m) => m.type)).toEqual([
      'installment_overdue',
      'installment_pending',
    ]);
    expect(s.upcoming.map((u) => u.id)).toEqual(['n']);
  });

  it('en un mes pasado, la vencida no se arrastra pero sigue en la lista de vencidas', () => {
    const s = buildSummary({
      ...base,
      range: { from: '2026-09-01', to: '2026-09-30' },
      credits: [credit('tv', [inst('o', '2026-10-31', 300_000)])],
    });
    expect(s.totals.committed).toBe(0);
    expect(s.totals.overdue).toBe(300_000);
    expect(s.projection.map((p) => [p.month, p.total])).toEqual([
      ['2026-10', 300_000],
    ]);
  });

  it('lo pagado cuenta el día real, por el valor real y en la cuenta de donde salió', () => {
    const paid = inst('p', '2026-10-31', 300_000, {
      status: 'PAID',
      paidKey: '2026-11-03',
      paidAmount: 310_000,
      paidAccountId: 'neg',
    });
    const s = buildSummary({
      ...base,
      range: NOV,
      credits: [credit('tv', [paid])],
    });
    expect(s.totals.paidInstallments).toBe(310_000);
    expect(s.movements).toEqual([
      expect.objectContaining({
        type: 'installment_paid',
        date: '2026-11-03',
        amount: -310_000,
        accountName: 'Negocio',
      }),
    ]);
    expect(s.recent).toEqual([
      expect.objectContaining({
        type: 'INSTALLMENT',
        title: 'Cuota: Televisor',
        effect: -310_000,
      }),
    ]);

    const soloPersonal = buildSummary({
      ...base,
      scope: new Set(['per']),
      accountId: 'per',
      range: NOV,
      credits: [credit('tv', [paid])],
    });
    expect(soloPersonal.totals.paidInstallments).toBe(0);
    const soloNegocio = buildSummary({
      ...base,
      scope: new Set(['neg']),
      accountId: 'neg',
      range: NOV,
      credits: [credit('tv', [paid])],
    });
    expect(soloNegocio.totals.paidInstallments).toBe(310_000);
  });

  it('un crédito cancelado no compromete nada, pero sus pagos siguen en la historia', () => {
    const s = buildSummary({
      ...base,
      range: NOV,
      credits: [
        credit(
          'tv',
          [
            inst('p', '2026-11-02', 100_000, {
              status: 'PAID',
              paidKey: '2026-11-02',
            }),
            inst('o', '2026-10-31', 100_000),
            inst('f', '2026-12-31', 100_000),
          ],
          {
            status: 'CANCELLED',
          },
        ),
      ],
    });
    expect(s.totals).toEqual({
      income: 0,
      expense: 0,
      paidInstallments: 100_000,
      transfersIn: 0,
      transfersOut: 0,
      adjustments: 0,
      net: -100_000,
      available: -100_000,
      committed: 0,
      overdue: 0,
    });
    expect(s.overdue).toEqual([]);
    expect(s.projection).toEqual([]);
  });

  it('ingresos, gastos y cuotas del periodo, y el filtro por cuenta', () => {
    const transactions = [
      tx('i1', 'INCOME', '2026-11-01', 4_200_000, 'per', { note: 'Salario' }),
      tx('i2', 'INCOME', '2026-11-05', 850_000, 'neg', { note: 'Venta' }),
      tx('i3', 'INCOME', '2026-10-28', 999, 'per', { note: 'Fuera' }),
      tx('g1', 'EXPENSE', '2026-11-06', 18_000, 'per', {
        categoryId: 'comida',
      }),
    ];
    const credits = [
      credit('moto', [
        inst('p', '2026-11-05', 600_000, {
          status: 'PAID',
          paidKey: '2026-11-05',
        }),
      ]),
    ];
    const s = buildSummary({ ...base, range: NOV, transactions, credits });
    expect(s.totals).toEqual(
      expect.objectContaining({
        income: 5_050_000,
        expense: 18_000,
        paidInstallments: 600_000,
        net: 4_432_000,
        available: 4_432_000,
      }),
    );
    // La lista vieja solo trae ingresos y cuotas.
    expect(s.movements.map((m) => m.type)).toEqual([
      'income',
      'income',
      'installment_paid',
    ]);
    // La nueva trae todo, lo más reciente primero, con el título que corresponde.
    expect(s.recent.map((m) => [m.id, m.title])).toEqual([
      ['g1', 'Comida afuera'],
      ['i2', 'Venta'],
      ['p', 'Cuota: Moto'],
      ['i1', 'Salario'],
    ]);
    expect(s.movementCount).toBe(4);

    const negocio = buildSummary({
      ...base,
      scope: new Set(['neg']),
      accountId: 'neg',
      range: NOV,
      transactions,
      credits,
    });
    expect(negocio.totals).toEqual(
      expect.objectContaining({
        income: 850_000,
        expense: 0,
        paidInstallments: 0,
        available: 850_000,
      }),
    );
  });

  it('una transferencia solo cuenta si sale de lo que se mira', () => {
    const transactions = [
      tx('t1', 'TRANSFER', '2026-11-04', 200_000, 'per', {
        toAccountId: 'nequi',
      }),
      tx('t2', 'TRANSFER', '2026-11-04', 50_000, 'per', { toAccountId: 'neg' }),
    ];
    const todo = buildSummary({
      ...base,
      range: NOV,
      transactions,
      credits: [],
    });
    expect(todo.totals).toEqual(
      expect.objectContaining({ net: 0, transfersIn: 0, transfersOut: 0 }),
    );

    // El libro Personal (Personal y Nequi): lo que pasó al negocio salió; lo que pasó a Nequi no.
    const personal = buildSummary({
      ...base,
      scope: new Set(['per', 'nequi']),
      book: 'PERSONAL',
      range: NOV,
      transactions,
      credits: [],
    });
    expect(personal.totals).toEqual(
      expect.objectContaining({
        net: -50_000,
        transfersOut: 50_000,
        transfersIn: 0,
      }),
    );

    const nequi = buildSummary({
      ...base,
      scope: new Set(['nequi']),
      accountId: 'nequi',
      range: NOV,
      transactions,
      credits: [],
    });
    expect(nequi.totals).toEqual(
      expect.objectContaining({ net: 200_000, transfersIn: 200_000 }),
    );
    expect(nequi.recent.map((m) => m.id)).toEqual(['t1']);
  });

  it('proyecta por mes lo que viene después del periodo', () => {
    const s = buildSummary({
      ...base,
      range: NOV,
      credits: [
        credit('moto', [
          inst('a', '2026-12-15', 600_000),
          inst('b', '2027-01-15', 600_000),
        ]),
        credit('tv', [inst('c', '2026-12-31', 300_000)]),
      ],
    });
    expect(
      s.projection.map((p) => [p.month, p.total, p.installments.length]),
    ).toEqual([
      ['2026-12', 900_000, 2],
      ['2027-01', 600_000, 1],
    ]);
    expect(s.upcoming.map((u) => u.dueDate)).toEqual([
      '2026-12-15',
      '2026-12-31',
      '2027-01-15',
    ]);
  });
});
