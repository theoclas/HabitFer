import { Tooltip } from "antd";
import { formatCalendarDate } from "../../utils/dates";
import type { HabitStatsDetail } from "../../types";

type Props = { data: HabitStatsDetail["calendar"] };

export function HabitHeatmap({ data }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
      {data.map((d) => {
        const bg = !d.scheduled ? "var(--hf-surface)" : d.completed ? "var(--hf-ember)" : "var(--hf-track)";
        return (
          <Tooltip key={d.date} title={formatCalendarDate(d.date, "DD MMM") + (d.scheduled ? (d.completed ? " - Hecho" : " - Pendiente") : " - No programado")}>
            <div style={{ aspectRatio: "1", borderRadius: 6, background: bg, border: "1px solid var(--hf-line)" }} />
          </Tooltip>
        );
      })}
    </div>
  );
}

