import { suggestShortcuts, type SuggestTx } from './fernance-quick.utils';

const t = (extra: Partial<SuggestTx>): SuggestTx => ({
  type: 'EXPENSE',
  accountId: 'nequi',
  categoryId: 'cafe',
  amount: 3000,
  note: 'Tinto',
  merchant: null,
  dateKey: '2026-11-01',
  ...extra,
});

describe('suggestShortcuts', () => {
  it('sugiere lo que se repite al menos tres veces, lo más repetido primero', () => {
    const txs = [
      t({ dateKey: '2026-11-01' }),
      t({ dateKey: '2026-11-02', note: 'tinto' }),
      t({ dateKey: '2026-11-03', note: 'Tintó' }),
      t({
        dateKey: '2026-11-03',
        note: 'Almuerzo',
        amount: 18000,
        categoryId: 'almuerzo',
      }),
      t({
        dateKey: '2026-11-04',
        note: 'Almuerzo',
        amount: 18000,
        categoryId: 'almuerzo',
      }),
      t({
        dateKey: '2026-11-05',
        note: 'Almuerzo',
        amount: 18000,
        categoryId: 'almuerzo',
      }),
      t({
        dateKey: '2026-11-06',
        note: 'Almuerzo',
        amount: 18000,
        categoryId: 'almuerzo',
      }),
      t({
        dateKey: '2026-11-06',
        note: 'Bus',
        amount: 3200,
        categoryId: 'bus',
      }),
      t({
        dateKey: '2026-11-07',
        note: 'Bus',
        amount: 3200,
        categoryId: 'bus',
      }),
    ];
    expect(
      suggestShortcuts(txs, []).map((s) => [s.label, s.amount, s.count]),
    ).toEqual([
      ['Almuerzo', 18000, 4],
      ['Tinto', 3000, 3],
    ]);
  });

  it('no repite lo que ya está guardado y usa el comercio si no hay nota', () => {
    const txs = [1, 2, 3].map((d) =>
      t({ note: null, merchant: 'Juan Valdez', dateKey: `2026-11-0${d}` }),
    );
    expect(suggestShortcuts(txs, [])).toEqual([
      expect.objectContaining({
        label: 'Juan Valdez',
        merchant: 'Juan Valdez',
        count: 3,
        lastDate: '2026-11-03',
      }),
    ]);
    expect(
      suggestShortcuts(txs, [
        {
          type: 'EXPENSE',
          accountId: 'nequi',
          categoryId: 'cafe',
          amount: 3000,
          label: 'Juan Valdez',
          merchant: null,
        },
      ]),
    ).toEqual([]);
  });

  it('un monto distinto es otra cosa', () => {
    const txs = [t({}), t({ amount: 3500 }), t({ amount: 4000 })];
    expect(suggestShortcuts(txs, [])).toEqual([]);
  });
});
