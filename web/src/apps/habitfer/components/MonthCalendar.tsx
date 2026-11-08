import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState, type CSSProperties } from "react";
import type { DayStat } from "../../../types";
import { WEEKDAY_SHORT } from "../format";

type Props = {
  month: Dayjs;
  byDate: Map<string, DayStat>;
  color: string;
  notes: Map<string, string>;
  canPrev: boolean;
  onPrev: () => void;
  onNext: () => void;
};

/** Mes del habito: hecho, sin marcar, no tocaba, y notas. */
export function MonthCalendar({ month, byDate, color, notes, canPrev, onPrev, onNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const todayKey = dayjs().format("YYYY-MM-DD");
  const canNext = month.endOf("month").isBefore(dayjs(), "day");

  const cells = useMemo(() => {
    const first = month.startOf("month");
    const offset = (first.day() + 6) % 7;
    const count = month.daysInMonth();
    return [
      ...Array.from({ length: offset }, (_, i) => ({ key: `pad${i}`, pad: true as const })),
      ...Array.from({ length: count }, (_, i) => {
        const d = first.add(i, "day");
        return { key: d.format("YYYY-MM-DD"), pad: false as const, n: i + 1 };
      }),
    ];
  }, [month]);

  const done = cells.filter((c) => !c.pad && byDate.get(c.key)?.completed).length;
  const scheduled = cells.filter((c) => !c.pad && c.key <= todayKey && (byDate.get(c.key)?.scheduled ?? 0) > 0).length;

  const info = (key: string) => {
    const d = byDate.get(key);
    const label = dayjs(key).format("dddd D [de] MMMM");
    const note = notes.get(key);
    if (key > todayKey) return `${label}: todavía no llega.`;
    if (!d || d.scheduled === 0) return `${label}: no tocaba.`;
    return `${label}: ${d.completed ? "hecho" : "sin marcar"}${note ? ` · «${note}»` : ""}`;
  };

  return (
    <div className="hf-cal" style={{ "--c": color } as CSSProperties}>
      <div className="hf-cal__head">
        <button type="button" aria-label="Mes anterior" disabled={!canPrev} onClick={onPrev}>
          <LeftOutlined />
        </button>
        <b>{month.format("MMMM YYYY")}</b>
        <button type="button" aria-label="Mes siguiente" disabled={!canNext} onClick={onNext}>
          <RightOutlined />
        </button>
      </div>
      <div className="hf-cal__grid" role="grid" aria-label={month.format("MMMM YYYY")}>
        {WEEKDAY_SHORT.map((w) => (
          <span key={w} className="hf-cal__wd">
            {w}
          </span>
        ))}
        {cells.map((c) => {
          if (c.pad) return <span key={c.key} />;
          const d = byDate.get(c.key);
          const future = c.key > todayKey;
          const cls = [
            "hf-cal__day",
            future ? "is-future" : d?.completed ? "is-done" : d && d.scheduled > 0 ? (c.key === todayKey ? "is-pending" : "is-miss") : "is-off",
            c.key === todayKey ? "is-today" : "",
            c.key === selected ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button key={c.key} type="button" className={cls} onClick={() => setSelected(c.key === selected ? null : c.key)} aria-label={info(c.key)}>
              {c.n}
              {notes.has(c.key) && <i className="hf-cal__note" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="hf-note" aria-live="polite">
        {selected ? info(selected) : `${done} de ${scheduled} días cumplidos este mes`}
      </p>
    </div>
  );
}
