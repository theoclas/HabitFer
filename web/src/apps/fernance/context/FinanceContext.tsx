import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type FinanceContextValue = {
  accountId: string | null;
  setAccountId: (id: string | null) => void;
  year: number;
  month: number;
  bounds: { from: string; to: string };
  shiftMonth: (delta: number) => void;
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

export function FinanceProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const { year, month } = period;
  const bounds = useMemo(() => monthBounds(year, month), [year, month]);

  const shiftMonth = useCallback((delta: number) => {
    setPeriod((p) => {
      const d = new Date(p.year, p.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }, []);

  const value = useMemo(
    () => ({ accountId, setAccountId, year, month, bounds, shiftMonth }),
    [accountId, year, month, bounds, shiftMonth],
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
