import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type PeriodMode = "month" | "range";

type FinanceContextValue = {
  accountId: string | null;
  setAccountId: (id: string | null) => void;
  periodMode: PeriodMode;
  year: number;
  month: number;
  bounds: { from: string; to: string };
  shiftMonth: (delta: number) => void;
  setPeriodMode: (mode: PeriodMode) => void;
  setCustomRange: (from: string, to: string) => void;
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
  const [periodMode, setPeriodModeState] = useState<PeriodMode>("month");
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [customRange, setCustomRangeState] = useState<{ from: string; to: string } | null>(null);

  const { year, month } = period;

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

  const value = useMemo(
    () => ({
      accountId,
      setAccountId,
      periodMode,
      year,
      month,
      bounds,
      shiftMonth,
      setPeriodMode,
      setCustomRange,
    }),
    [accountId, periodMode, year, month, bounds, shiftMonth, setPeriodMode, setCustomRange],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinanceContext() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinanceContext debe usarse dentro de FinanceProvider");
  return ctx;
}

/** @deprecated use useFinanceContext */
export const AccountFilterProvider = FinanceProvider;
/** @deprecated use useFinanceContext */
export const useAccountFilter = useFinanceContext;
/** @deprecated use useFinanceContext */
export const useMonthRange = useFinanceContext;
