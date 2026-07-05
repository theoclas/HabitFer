import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { UnlockedAchievement } from "../../types";
import { AchievementModal } from "./AchievementModal";

type AchievementContextValue = {
  celebrate: (achievement: UnlockedAchievement) => void;
};

const AchievementContext = createContext<AchievementContextValue | null>(null);

export function AchievementProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<UnlockedAchievement | null>(null);

  const celebrate = useCallback((achievement: UnlockedAchievement) => {
    setCurrent(achievement);
  }, []);

  const value = useMemo(() => ({ celebrate }), [celebrate]);

  return (
    <AchievementContext.Provider value={value}>
      {children}
      <AchievementModal achievement={current} onClose={() => setCurrent(null)} />
    </AchievementContext.Provider>
  );
}

export function useAchievements() {
  const ctx = useContext(AchievementContext);
  if (!ctx) throw new Error("useAchievements must be used within AchievementProvider");
  return ctx;
}
