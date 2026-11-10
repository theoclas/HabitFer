import {
  buildSummary,
  type SummaryCredit,
  type SummaryInstallment,
} from './fernance-summary.utils';

const names = new Map([
  ['per', 'Personal'],
  ['neg', 'Negocio'],
]);

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

const NOV = { from: '2026-11-01', to: '2026-11-30' };
const base = {
  todayKey: '2026-11-09',
  accountId: null,
  accountNames: names,
  incomes: [],
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

    const soloPersonal = buildSummary({
      ...base,
      accountId: 'per',
      range: NOV,
      credits: [credit('tv', [paid])],
    });
    expect(soloPersonal.totals.paidInstallments).toBe(0);
    const soloNegocio = buildSummary({
      ...base,
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
      paidInstallments: 100_000,
      available: -100_000,
      committed: 0,
      overdue: 0,
    });
    expect(s.overdue).toEqual([]);
    expect(s.projection).toEqual([]);
  });

  it('ingresos del periodo, disponible y filtro por cuenta', () => {
    const incomes = [
      {
        id: 'i1',
        dateKey: '2026-11-01',
        amount: 4_200_000,
        label: 'Salario',
        accountId: 'per',
        accountName: 'Personal',
      },
      {
        id: 'i2',
        dateKey: '2026-11-05',
        amount: 850_000,
        label: 'Venta',
        accountId: 'neg',
        accountName: 'Negocio',
      },
      {
        id: 'i3',
        dateKey: '2026-10-28',
        amount: 999,
        label: 'Fuera',
        accountId: 'per',
        accountName: 'Personal',
      },
    ];
    const credits = [
      credit('moto', [
        inst('p', '2026-11-05', 600_000, {
          status: 'PAID',
          paidKey: '2026-11-05',
        }),
      ]),
    ];
    const s = buildSummary({ ...base, range: NOV, incomes, credits });
    expect(s.totals.income).toBe(5_050_000);
    expect(s.totals.available).toBe(4_450_000);
    const negocio = buildSummary({
      ...base,
      accountId: 'neg',
      range: NOV,
      incomes,
      credits,
    });
    expect(negocio.totals).toEqual(
      expect.objectContaining({
        income: 850_000,
        paidInstallments: 0,
        available: 850_000,
      }),
    );
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
