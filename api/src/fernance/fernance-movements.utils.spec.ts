import {
  combineBalances,
  effectOn,
  installmentToItem,
  movementTotals,
  sortMovements,
  txToItem,
  type MovementLookups,
  type MovementTx,
} from './fernance-movements.utils';

const lookups: MovementLookups = {
  accounts: new Map([
    ['banco', { name: 'Bancolombia', color: '#D4AF37' }],
    ['nequi', { name: 'Nequi', color: null }],
    ['tc', { name: 'Tarjeta Nu', color: null }],
  ]),
  categories: new Map([['cafe', { name: 'Tinto y café', icon: '☕' }]]),
};

const tx = (extra: Partial<MovementTx>): MovementTx => ({
  id: 'x',
  type: 'EXPENSE',
  dateKey: '2026-11-10',
  amount: 1000,
  accountId: 'banco',
  toAccountId: null,
  categoryId: null,
  merchant: null,
  note: null,
  source: 'MANUAL',
  needsReview: false,
  createdAt: null,
  ...extra,
});

describe('effectOn', () => {
  it('cada tipo suma o resta en su cuenta', () => {
    const banco = new Set(['banco']);
    expect(effectOn('INCOME', 'banco', null, 100, banco)).toBe(100);
    expect(effectOn('EXPENSE', 'banco', null, 100, banco)).toBe(-100);
    expect(effectOn('INSTALLMENT', 'banco', null, 100, banco)).toBe(-100);
    expect(effectOn('ADJUSTMENT', 'banco', null, -40, banco)).toBe(-40);
    expect(effectOn('EXPENSE', 'nequi', null, 100, banco)).toBe(0);
  });

  it('una transferencia entre lo que se mira no mueve nada', () => {
    expect(
      effectOn('TRANSFER', 'banco', 'nequi', 100, new Set(['banco'])),
    ).toBe(-100);
    expect(
      effectOn('TRANSFER', 'banco', 'nequi', 100, new Set(['nequi'])),
    ).toBe(100);
    expect(
      effectOn('TRANSFER', 'banco', 'nequi', 100, new Set(['banco', 'nequi'])),
    ).toBe(0);
  });
});

describe('txToItem e installmentToItem', () => {
  it('el título es la nota, el comercio, la categoría o el tipo', () => {
    const scope = new Set(['banco', 'nequi']);
    expect(
      txToItem(
        tx({ note: 'Con Juan', merchant: 'Oma', categoryId: 'cafe' }),
        lookups,
        scope,
      ).title,
    ).toBe('Con Juan');
    expect(
      txToItem(tx({ merchant: 'Oma', categoryId: 'cafe' }), lookups, scope)
        .title,
    ).toBe('Oma');
    expect(txToItem(tx({ categoryId: 'cafe' }), lookups, scope)).toMatchObject({
      title: 'Tinto y café',
      categoryIcon: '☕',
      accountName: 'Bancolombia',
      accountColor: '#D4AF37',
    });
    expect(
      txToItem(tx({ type: 'TRANSFER', toAccountId: 'nequi' }), lookups, scope),
    ).toMatchObject({
      title: 'Transferencia',
      toAccountName: 'Nequi',
      effect: 0,
    });
    // Una categoría que ya no existe no rompe nada.
    expect(
      txToItem(tx({ categoryId: 'borrada' }), lookups, scope),
    ).toMatchObject({ categoryId: null, title: 'Gasto' });
  });

  it('una cuota pagada', () => {
    expect(
      installmentToItem(
        {
          id: 'c1',
          creditId: 'tv',
          creditName: 'Televisor',
          dateKey: '2026-11-05',
          amount: 300_000,
          accountId: 'tc',
        },
        lookups,
        new Set(['tc']),
      ),
    ).toMatchObject({
      type: 'INSTALLMENT',
      title: 'Cuota: Televisor',
      effect: -300_000,
      accountName: 'Tarjeta Nu',
    });
  });
});

describe('sortMovements y movementTotals', () => {
  it('ordena y suma', () => {
    const scope = new Set(['banco']);
    const items = sortMovements([
      txToItem(
        tx({
          id: 'a',
          type: 'INCOME',
          amount: 4_000_000,
          dateKey: '2026-11-01',
        }),
        lookups,
        scope,
      ),
      txToItem(
        tx({
          id: 'b',
          amount: 18_000,
          dateKey: '2026-11-03',
          createdAt: '2026-11-03T10:00:00Z',
        }),
        lookups,
        scope,
      ),
      txToItem(
        tx({
          id: 'c',
          amount: 3_000,
          dateKey: '2026-11-03',
          createdAt: '2026-11-03T18:00:00Z',
        }),
        lookups,
        scope,
      ),
      txToItem(
        tx({
          id: 'd',
          type: 'TRANSFER',
          amount: 200_000,
          toAccountId: 'nequi',
        }),
        lookups,
        scope,
      ),
      txToItem(
        tx({ id: 'e', type: 'ADJUSTMENT', amount: -5_000 }),
        lookups,
        scope,
      ),
      installmentToItem(
        {
          id: 'f',
          creditId: 'tv',
          creditName: 'TV',
          dateKey: '2026-11-02',
          amount: 300_000,
          accountId: 'banco',
        },
        lookups,
        scope,
      ),
    ]);
    expect(items.map((m) => m.id)).toEqual(['e', 'd', 'c', 'b', 'f', 'a']);
    expect(movementTotals(items)).toEqual({
      income: 4_000_000,
      expense: 21_000,
      installments: 300_000,
      transfersIn: 0,
      transfersOut: 200_000,
      adjustments: -5_000,
      net: 3_474_000,
      count: 6,
    });
  });
});

describe('combineBalances', () => {
  it('saldo inicial, movimientos, transferencias y cuotas pagadas', () => {
    const balances = combineBalances(
      [
        { id: 'banco', openingBalance: 1_000_000 },
        { id: 'nequi', openingBalance: 0 },
        { id: 'tc', openingBalance: -500_000 },
      ],
      [
        { accountId: 'banco', type: 'INCOME', sum: 4_000_000 },
        { accountId: 'banco', type: 'EXPENSE', sum: 100_000 },
        { accountId: 'banco', type: 'TRANSFER', sum: 300_000 },
        { accountId: 'nequi', type: 'ADJUSTMENT', sum: -2_000 },
        { accountId: 'tc', type: 'EXPENSE', sum: 80_000 },
        { accountId: 'otra', type: 'INCOME', sum: 1 },
      ],
      [
        { accountId: 'nequi', sum: 200_000 },
        { accountId: 'tc', sum: 100_000 },
      ],
      [{ accountId: 'banco', amount: 250_000 }],
    );
    expect(Object.fromEntries(balances)).toEqual({
      banco: 4_350_000,
      nequi: 198_000,
      tc: -480_000,
    });
  });
});
