import { normalizeKeyword } from './text/money-text.parse';

export type SuggestTx = {
  type: 'INCOME' | 'EXPENSE';
  accountId: string;
  categoryId: string | null;
  amount: number;
  note: string | null;
  merchant: string | null;
  dateKey: string;
};

export type ShortcutLike = {
  type: 'INCOME' | 'EXPENSE';
  accountId: string;
  categoryId: string | null;
  amount: number;
  label: string;
  merchant: string | null;
};

export type Suggestion = {
  /** La nota o el comercio; null = mostrar la categoría. */
  label: string | null;
  type: 'INCOME' | 'EXPENSE';
  accountId: string;
  categoryId: string | null;
  amount: number;
  merchant: string | null;
  /** Cuántas veces se repitió. */
  count: number;
  lastDate: string;
};

/** Desde cuántas veces se sugiere como «lo de siempre». */
export const SUGGEST_MIN_COUNT = 3;

/**
 * «Lo de siempre» que se sugiere solo: lo que se repite igual (mismo tipo, cuenta, categoría, monto y nota o
 * comercio) al menos tres veces, sin lo que ya está guardado. Lo más repetido primero; si empatan, lo más reciente.
 */
export function suggestShortcuts(
  txs: SuggestTx[],
  saved: ShortcutLike[],
  limit = 6,
): Suggestion[] {
  const keyOf = (s: {
    type: string;
    accountId: string;
    categoryId: string | null;
    amount: number;
    label: string | null;
  }) =>
    [
      s.type,
      s.accountId,
      s.categoryId ?? '',
      Math.round(s.amount),
      normalizeKeyword(s.label ?? ''),
    ].join('|');
  const savedKeys = new Set(
    saved.map((s) => keyOf({ ...s, label: s.label || s.merchant })),
  );
  const groups = new Map<string, Suggestion>();
  for (const t of txs) {
    const label = t.note || t.merchant || null;
    const key = keyOf({ ...t, label });
    const g = groups.get(key);
    if (g) {
      g.count++;
      if (t.dateKey > g.lastDate) g.lastDate = t.dateKey;
    } else {
      groups.set(key, {
        label,
        type: t.type,
        accountId: t.accountId,
        categoryId: t.categoryId,
        amount: Math.round(t.amount),
        merchant: t.merchant,
        count: 1,
        lastDate: t.dateKey,
      });
    }
  }
  return [...groups.entries()]
    .filter(([key, g]) => g.count >= SUGGEST_MIN_COUNT && !savedKeys.has(key))
    .map(([, g]) => g)
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit);
}
