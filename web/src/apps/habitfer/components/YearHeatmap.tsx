import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DayStat } from "../../../types";
import { fmtInt } from "../format";

type Props = {
  year: number;
  days: DayStat[] | null;
  /** "global": intensidad = % del dia y azul = dia perfecto. "habit": color del habito si se cumplio. */
  mode: "global" | "habit";
  color?: string;
  minYear: number;
  onYearChange: (year: number) => void;
  /** Dias con nota (solo modo habito): llevan un punto. */
  noteDates?: Set<string>;
};

const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 20;
const TOP = 16;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function globalFill(d: DayStat | undefined): string {
  if (!d || d.scheduled === 0) return "var(--hf-empty)";
  if (d.perfect) return "var(--hf-blue)";
  if (d.rate === 0) return "var(--hf-track)";
  const pct = d.rate < 34 ? 32 : d.rate < 67 ? 58 : 84;
  return `color-mix(in srgb, var(--hf-ember) ${pct}%, var(--hf-raised))`;
}

/** Un año en cuadritos (semanas de lunes a domingo), con navegacion por año y detalle del dia tocado. */
export function YearHeatmap({ year, days, mode, color, minYear, onYearChange, noteDates }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const today = dayjs().format("YYYY-MM-DD");
  const currentYear = dayjs().year();

  const byDate = useMemo(() => new Map((days ?? []).map((d) => [d.date, d])), [days]);

  const layout = useMemo(() => {
    const jan1 = dayjs(`${year}-01-01`);
    const offset = (jan1.day() + 6) % 7; // lunes = 0
    const total = jan1.add(1, "year").diff(jan1, "day");
    const cols = Math.ceil((offset + total) / 7);
    const cells = Array.from({ length: total }, (_, i) => {
      const idx = offset + i;
      return { key: jan1.add(i, "day").format("YYYY-MM-DD"), col: Math.floor(idx / 7), row: idx % 7 };
    });
    const months = MONTHS.map((label, m) => {
      const first = dayjs(`${year}-${String(m + 1).padStart(2, "0")}-01`);
      return { label, col: Math.floor((offset + first.diff(jan1, "day")) / 7) };
    });
    return { cells, cols, months };
  }, [year]);

  // En el año actual, arranca mostrando las ultimas semanas (en el movil no cabe el año entero).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = year === currentYear ? el.scrollWidth : 0;
  }, [year, currentYear, days]);

  const summary = useMemo(() => {
    let completed = 0;
    let perfect = 0;
    for (const d of days ?? []) {
      completed += d.completed;
      if (d.perfect) perfect++;
    }
    return { completed, perfect };
  }, [days]);

  const width = LEFT + layout.cols * STEP;
  const height = TOP + 7 * STEP;

  const fill = (key: string): string => {
    if (key > today) return "transparent";
    const d = byDate.get(key);
    if (mode === "global") return globalFill(d);
    if (!d || d.scheduled === 0) return "var(--hf-empty)";
    return d.completed > 0 ? color ?? "var(--hf-ember)" : "var(--hf-track)";
  };

  const describe = (key: string) => {
    const d = byDate.get(key);
    const label = dayjs(key).format("ddd D MMM");
    if (key > today) return `${label} · todavía no llega`;
    if (!d || d.scheduled === 0) return `${label} · nada programado`;
    if (mode === "habit") return `${label} · ${d.completed ? "hecho" : "sin marcar"}`;
    return `${label} · ${d.completed} de ${d.scheduled}${d.perfect ? " · día perfecto" : ` (${d.rate} %)`}`;
  };

  return (
    <div className="hf-heat">
      <div className="hf-heat__bar">
        <div className="hf-heat__nav">
          <button type="button" aria-label="Año anterior" disabled={year <= minYear} onClick={() => onYearChange(year - 1)}>
            <LeftOutlined />
          </button>
          <b>{year}</b>
          <button type="button" aria-label="Año siguiente" disabled={year >= currentYear} onClick={() => onYearChange(year + 1)}>
            <RightOutlined />
          </button>
        </div>
        <span className="hf-heat__sum">
          {days === null
            ? "Cargando…"
            : mode === "global"
              ? `${fmtInt(summary.completed)} hábitos cumplidos · ${summary.perfect} días perfectos`
              : `${fmtInt(summary.completed)} veces en ${year}`}
        </span>
      </div>

      <div className="hf-heat__scroll" ref={scrollRef}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Mapa de ${year}`} style={{ opacity: days === null ? 0.4 : 1 }}>
          {layout.months.map((m) => (
            <text key={m.label} x={LEFT + m.col * STEP} y={10} className="hf-heat__month">
              {m.label}
            </text>
          ))}
          {["L", "X", "V"].map((d, i) => (
            <text key={d} x={0} y={TOP + i * 2 * STEP + 10} className="hf-heat__month">
              {d}
            </text>
          ))}
          {layout.cells.map((c) => (
            <rect
              key={c.key}
              x={LEFT + c.col * STEP}
              y={TOP + c.row * STEP}
              width={CELL}
              height={CELL}
              rx={3}
              style={{
                fill: fill(c.key),
                stroke: c.key === today ? "var(--hf-fg)" : c.key === selected ? "var(--hf-ember)" : c.key > today ? "var(--hf-line)" : "none",
                strokeWidth: c.key === today || c.key === selected ? 1.5 : 1,
                cursor: c.key > today ? "default" : "pointer",
              } as CSSProperties}
              onClick={() => c.key <= today && setSelected(c.key === selected ? null : c.key)}
            >
              <title>{describe(c.key)}</title>
            </rect>
          ))}
          {noteDates &&
            layout.cells
              .filter((c) => noteDates.has(c.key))
              .map((c) => (
                <circle key={`n${c.key}`} cx={LEFT + c.col * STEP + CELL / 2} cy={TOP + c.row * STEP + CELL / 2} r={1.8} style={{ fill: "var(--hf-bg)", pointerEvents: "none" }} />
              ))}
        </svg>
      </div>

      <div className="hf-heat__foot">
        <span className="hf-heat__detail" aria-live="polite">
          {selected ? describe(selected) : "Toca un día para ver el detalle"}
        </span>
        {mode === "global" ? (
          <span className="hf-heat__legend">
            menos
            <i style={{ background: "var(--hf-track)" }} />
            <i style={{ background: globalFill({ date: "", scheduled: 1, completed: 1, rate: 20, perfect: false }) }} />
            <i style={{ background: globalFill({ date: "", scheduled: 1, completed: 1, rate: 50, perfect: false }) }} />
            <i style={{ background: globalFill({ date: "", scheduled: 1, completed: 1, rate: 80, perfect: false }) }} />
            más
            <i style={{ background: "var(--hf-blue)", marginLeft: 8 }} />
            perfecto
          </span>
        ) : (
          <span className="hf-heat__legend">
            <i style={{ background: "var(--hf-track)" }} />
            sin marcar
            <i style={{ background: color ?? "var(--hf-ember)", marginLeft: 8 }} />
            hecho
          </span>
        )}
      </div>
    </div>
  );
}
