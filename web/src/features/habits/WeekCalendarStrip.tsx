import dayjs, { type Dayjs } from "dayjs";
import type { ReactNode } from "react";
import "dayjs/locale/es";

dayjs.locale("es");

const DAY_SHORT = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

type Props = {
  selected: Dayjs;
  onSelect: (day: Dayjs) => void;
  progressByDate?: Record<string, number>;
  vertical?: boolean;
};

function ProgressRing({ rate, active, children }: { rate: number; active: boolean; children: ReactNode }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (rate / 100) * c;
  return (
    <svg width={44} height={44} style={{ display: "block" }}>
      <circle cx={22} cy={22} r={r} fill="none" stroke={active ? "rgba(255,255,255,0.25)" : "#2a2a3a"} strokeWidth={3} />
      <circle
        cx={22}
        cy={22}
        r={r}
        fill="none"
        stroke={active ? "#fff" : "#3b82f6"}
        strokeWidth={3}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        style={{ transition: "stroke-dashoffset 0.3s" }}
      />
      <foreignObject x={0} y={0} width={44} height={44}>
        <div style={{ width: 44, height: 44, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600, color: active ? "#fff" : "#e2e8f0" }}>
          {children}
        </div>
      </foreignObject>
    </svg>
  );
}

export function WeekCalendarStrip({ selected, onSelect, progressByDate = {}, vertical = false }: Props) {
  const start = selected.startOf("week");
  const days = Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
  const todayKey = dayjs().format("YYYY-MM-DD");

  return (
    <div
      className={vertical ? "week-strip" : undefined}
      style={{
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        gap: vertical ? 6 : 8,
        overflowX: vertical ? "visible" : "auto",
        padding: vertical ? 0 : "4px 0 12px",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {days.map((day) => {
        const key = day.format("YYYY-MM-DD");
        const isSelected = day.isSame(selected, "day");
        const isToday = key === todayKey;
        const rate = progressByDate[key] ?? 0;

        return (
          <button
            key={key}
            type="button"
            className={vertical ? "week-strip__day" : undefined}
            onClick={() => onSelect(day)}
            style={{
              flex: vertical ? undefined : "0 0 auto",
              width: vertical ? "100%" : undefined,
              border: "none",
              cursor: "pointer",
              background: isSelected ? "#2563eb" : vertical ? "rgba(255,255,255,0.04)" : "transparent",
              borderRadius: vertical ? 14 : 20,
              padding: vertical ? "10px 14px" : isSelected ? "8px 10px" : "8px 6px",
              display: "flex",
              flexDirection: vertical ? "row" : "column",
              alignItems: "center",
              justifyContent: vertical ? "space-between" : undefined,
              gap: vertical ? 0 : 6,
              minWidth: vertical ? undefined : 52,
            }}
          >
            <span style={{ fontSize: 11, color: isSelected ? "#fff" : "#64748b", textTransform: "lowercase" }}>
              {DAY_SHORT[day.day()]}
            </span>
            <ProgressRing rate={rate} active={isSelected}>
              {day.date()}
            </ProgressRing>
            {isToday && !isSelected && vertical && (
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2dd4bf", flexShrink: 0 }} />
            )}
            {isToday && !isSelected && !vertical && (
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#2dd4bf" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
