import { Tooltip } from "antd";
import { formatCalendarDate } from "../../utils/dates";
import type { HabitStatsDetail } from "../../types";

type Props = { data: HabitStatsDetail["calendar"] };

export function HabitHeatmap({ data }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
      {data.map((d) => {
        const bg = !d.scheduled ? "#1e293b" : d.completed ? "#22d3ee" : "#334155";
        return (
          <Tooltip key={d.date} title={formatCalendarDate(d.date, "DD MMM") + (d.scheduled ? (d.completed ? " - Hecho" : " - Pendiente") : " - No programado")}>
            <div style={{ aspectRatio: "1", borderRadius: 6, background: bg, border: "1px solid #475569" }} />
          </Tooltip>
        );
      })}
    </div>
  );
}

