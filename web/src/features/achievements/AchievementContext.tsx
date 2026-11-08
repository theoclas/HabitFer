import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { UnlockedAchievement } from "../../types";
import { AchievementModal } from "./AchievementModal";
import { PerfectDayOverlay, type PerfectDayInfo } from "./PerfectDayOverlay";

type Celebration =
  | { kind: "achievement"; data: UnlockedAchievement; replay?: boolean }
  | { kind: "perfect"; data: PerfectDayInfo };

type AchievementContextValue = {
  /** Logro recien ganado (o `replay` para volver a ver uno de la vitrina). */
  celebrate: (achievement: UnlockedAchievement, opts?: { replay?: boolean }) => void;
  celebratePerfectDay: (info: PerfectDayInfo) => void;
};

const AchievementContext = createContext<AchievementContextValue | null>(null);

/** Cola de celebraciones: si se gana un logro y se completa el dia a la vez, se muestran en orden. */
export function AchievementProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Celebration[]>([]);

  const celebrate = useCallback((achievement: UnlockedAchievement, opts?: { replay?: boolean }) => {
    setQueue((q) => [...q, { kind: "achievement", data: achievement, replay: opts?.replay }]);
  }, []);

  const celebratePerfectDay = useCallback((info: PerfectDayInfo) => {
    setQueue((q) => (q.some((c) => c.kind === "perfect") ? q : [...q, { kind: "perfect", data: info }]));
  }, []);

  const closeCurrent = useCallback(() => setQueue((q) => q.slice(1)), []);

  const value = useMemo(() => ({ celebrate, celebratePerfectDay }), [celebrate, celebratePerfectDay]);
  const current = queue[0];

  return (
    <AchievementContext.Provider value={value}>
      {children}
      <AchievementModal
        achievement={current?.kind === "achievement" ? current.data : null}
        replay={current?.kind === "achievement" ? current.replay : false}
        onClose={closeCurrent}
      />
      {current?.kind === "perfect" && <PerfectDayOverlay info={current.data} onClose={closeCurrent} />}
    </AchievementContext.Provider>
  );
}

export function useAchievements() {
  const ctx = useContext(AchievementContext);
  if (!ctx) throw new Error("useAchievements must be used within AchievementProvider");
  return ctx;
}
