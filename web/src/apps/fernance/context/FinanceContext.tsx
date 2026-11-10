import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchCategories, fetchFinanceAccounts, type ScopeParams } from "../api";
import type { EntryType, FinanceAccount, FinanceAccountType, FinanceCategory, MovementItem } from "../types";

export type PeriodMode = "month" | "range";

/** Qué abrir en la hoja de «Anotar»: un movimiento para editar o uno nuevo con algo ya escogido. */
export type QuickAddRequest = {
  edit?: MovementItem | null;
  type?: EntryType;
  accountId?: string;
  toAccountId?: string;
};

type FinanceContextValue = {
  /** Cuenta elegida en el filtro; null = un libro o todo. */
  accountId: string | null;
  /** Libro elegido en el filtro; null = una cuenta o todo. */
  book: FinanceAccountType | null;
  setScope: (scope: { accountId?: string | null; book?: FinanceAccountType | null }) => void;
  /** Para la API: { accountId } o { book } o nada. */
  scopeParams: ScopeParams;
  /** Cuentas activas (sin las de la papelera), compartidas por todas las pantallas. */
  accounts: FinanceAccount[];
  accountsLoaded: boolean;
  reloadAccounts: () => Promise<void>;
  /** Categorías activas, compartidas. */
  categories: FinanceCategory[];
  categoriesLoaded: boolean;
  reloadCategories: () => Promise<void>;
  periodMode: PeriodMode;
  year: number;
  month: number;
  bounds: { from: string; to: string };
  shiftMonth: (delta: number) => void;
  setPeriodMode: (mode: PeriodMode) => void;
  setCustomRange: (from: string, to: string) => void;
  /** La hoja de «Anotar», abierta desde cualquier pantalla. */
  quickAdd: QuickAddRequest | null;
  openQuickAdd: (request?: QuickAddRequest) => void;
  closeQuickAdd: () => void;
  /** Sube cada vez que algo cambia la plata: las pantallas recargan. */
  dataVersion: number;
  bumpData: () => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function monthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

export function rangeLabel(from: string, to: string): string {
  const fmt = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [book, setBook] = useState<FinanceAccountType | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [periodMode, setPeriodModeState] = useState<PeriodMode>("month");
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [customRange, setCustomRangeState] = useState<{ from: string; to: string } | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddRequest | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const { year, month } = period;

  const reloadAccounts = useCallback(async () => {
    try {
      setAccounts(await fetchFinanceAccounts());
    } catch {
      /* la pantalla muestra su propio error */
    } finally {
      setAccountsLoaded(true);
    }
  }, []);

  const reloadCategories = useCallback(async () => {
    try {
      setCategories(await fetchCategories());
    } catch {
      /* se reintenta al abrir la hoja */
    } finally {
      setCategoriesLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reloadAccounts();
    void reloadCategories();
  }, [reloadAccounts, reloadCategories]);

  // Si la cuenta del filtro se archiva, el filtro vuelve a «todo».
  useEffect(() => {
    if (accountId && accountsLoaded && !accounts.some((a) => a.id === accountId)) setAccountId(null);
  }, [accountId, accounts, accountsLoaded]);

  const setScope = useCallback((scope: { accountId?: string | null; book?: FinanceAccountType | null }) => {
    setAccountId(scope.accountId ?? null);
    setBook(scope.accountId ? null : (scope.book ?? null));
  }, []);

  const scopeParams = useMemo<ScopeParams>(
    () => (accountId ? { accountId } : book ? { book } : {}),
    [accountId, book],
  );

  const bounds = useMemo(() => {
    if (periodMode === "range" && customRange) return customRange;
    return monthBounds(year, month);
  }, [periodMode, customRange, year, month]);

  const shiftMonth = useCallback((delta: number) => {
    setPeriodModeState("month");
    setCustomRangeState(null);
    setPeriod((p) => {
      const d = new Date(p.year, p.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }, []);

  const setPeriodMode = useCallback(
    (mode: PeriodMode) => {
      if (mode === "month") {
        const [y, m] = bounds.from.split("-").map(Number);
        setPeriod({ year: y, month: m });
        setCustomRangeState(null);
      } else {
        setCustomRangeState(customRange ?? monthBounds(year, month));
      }
      setPeriodModeState(mode);
    },
    [bounds.from, customRange, year, month],
  );

  const setCustomRange = useCallback((from: string, to: string) => {
    setPeriodModeState("range");
    setCustomRangeState({ from, to });
  }, []);

  const openQuickAdd = useCallback((request: QuickAddRequest = {}) => setQuickAdd(request), []);
  const closeQuickAdd = useCallback(() => setQuickAdd(null), []);
  const bumpData = useCallback(() => {
    setDataVersion((v) => v + 1);
    void reloadAccounts();
    // Las más usadas van primero al escoger: el uso cambia con cada movimiento.
    void reloadCategories();
  }, [reloadAccounts, reloadCategories]);

  const value = useMemo(
    () => ({
      accountId,
      book,
      setScope,
      scopeParams,
      accounts,
      accountsLoaded,
      reloadAccounts,
      categories,
      categoriesLoaded,
      reloadCategories,
      periodMode,
      year,
      month,
      bounds,
      shiftMonth,
      setPeriodMode,
      setCustomRange,
      quickAdd,
      openQuickAdd,
      closeQuickAdd,
      dataVersion,
      bumpData,
    }),
    [
      accountId,
      book,
      setScope,
      scopeParams,
      accounts,
      accountsLoaded,
      reloadAccounts,
      categories,
      categoriesLoaded,
      reloadCategories,
      periodMode,
      year,
      month,
      bounds,
      shiftMonth,
      setPeriodMode,
      setCustomRange,
      quickAdd,
      openQuickAdd,
      closeQuickAdd,
      dataVersion,
      bumpData,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinanceContext() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinanceContext debe usarse dentro de FinanceProvider");
  return ctx;
}
