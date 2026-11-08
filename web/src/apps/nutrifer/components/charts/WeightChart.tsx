import dayjs from "dayjs";
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { WeightPoint } from "../../types";
import { useCloseOutside, useWidth } from "./chartUtils";

type Props = {
  points: WeightPoint[];
  /** Primer y último día del eje (el rango elegido; termina hoy). */
  from: string;
  to: string;
};

const H = 220;
const M = { top: 16, right: 54, bottom: 30, left: 42 };

const kg1 = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dayMs = 86_400_000;
const t = (key: string) => dayjs(key).valueOf();

/** Marcas del eje de kilos (no empieza en cero: el peso se mueve poco). */
function kgTicks(min: number, max: number) {
  const span = Math.max(0.5, max - min);
  const step = [0.2, 0.5, 1, 2, 5, 10].find((s) => span / s <= 5) ?? 10;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  return { ticks, lo, hi: hi === lo ? lo + step : hi };
}

/**
 * Peso de cada día (puntos grises) y su tendencia (línea verde): la tendencia es lo que importa; los puntos
 * saltan por agua y sal. Pasar el dedo o el mouse (o las flechas del teclado) muestra cada día.
 */
export function WeightChart({ points, from, to }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const [active, setActive] = useState<number | null>(null);
  const clear = useCallback(() => setActive(null), []);
  useCloseOutside(ref, active != null, clear);

  const plotW = Math.max(40, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const start = Math.min(t(from), points.length ? t(points[0].date) : t(from));
  const end = Math.max(t(to), start + dayMs);
  const values = points.flatMap((p) => [p.kg, p.trend]);
  const { ticks, lo, hi } = kgTicks(Math.min(...values) - 0.3, Math.max(...values) + 0.3);
  const x = (key: string) => M.left + ((t(key) - start) / (end - start)) * plotW;
  const y = (v: number) => M.top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.trend).toFixed(1)}`).join("");
  const last = points[points.length - 1];

  const nearest = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || points.length === 0) return null;
    const px = clientX - box.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    });
    return best;
  };
  const onMove = (e: PointerEvent) => setActive(nearest(e.clientX));
  const onKey = (e: KeyboardEvent) => {
    if (!points.length) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = (active ?? points.length) + (e.key === "ArrowLeft" ? -1 : 1);
      setActive(Math.min(points.length - 1, Math.max(0, next)));
    } else if (e.key === "Escape") setActive(null);
  };

  // Etiquetas del eje de fechas: el inicio, la mitad y el final.
  const xLabels = [start, start + (end - start) / 2, end].map((ms) => dayjs(ms).format("YYYY-MM-DD"));
  const tip = active == null ? null : points[active];
  const tipLeft = tip ? Math.min(Math.max(x(tip.date), 84), width - 84) : 0;

  return (
    <div className="nf-chart" ref={ref}>
      <ul className="nf-legend-row" aria-label="Qué es cada marca">
        <li>
          <i className="nf-swatch nf-swatch--trend" />
          Tendencia
        </li>
        <li>
          <i className="nf-swatch nf-swatch--dot" />
          Peso del día
        </li>
      </ul>
      <div
        className="nf-chart__plot"
        tabIndex={0}
        role="img"
        aria-label={
          last
            ? `Peso: ${points.length} pesadas del ${dayjs(points[0].date).format("D [de] MMMM")} al ${dayjs(last.date).format("D [de] MMMM")}; tendencia actual ${kg1.format(last.trend)} kg. Usa las flechas para recorrer los días.`
            : "Sin pesadas"
        }
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={H} aria-hidden="true">
          {ticks.map((v) => (
            <g key={v}>
              <line className="nf-grid" x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} />
              <text className="nf-axis" x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
                {kg1.format(v)}
              </text>
            </g>
          ))}
          {xLabels.map((k, i) => (
            <text key={k + i} className="nf-axis" x={M.left + (plotW * i) / 2} y={H - 8} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>
              {dayjs(k).format("D MMM").replace(".", "")}
            </text>
          ))}
          {tip && <line className="nf-crosshair" x1={x(tip.date)} x2={x(tip.date)} y1={M.top} y2={M.top + plotH} />}
          {points.map((p, i) => (
            <circle key={p.date} className={`nf-wdot${i === active ? " is-active" : ""}`} cx={x(p.date)} cy={y(p.kg)} r={i === active ? 5 : 4} />
          ))}
          {points.length > 1 && <path className="nf-trendline" d={path} />}
          {last && (
            <>
              <circle className="nf-trenddot" cx={x(last.date)} cy={y(last.trend)} r={4} />
              <text className="nf-endlabel" x={x(last.date) + 8} y={y(last.trend)} dy="0.32em">
                {kg1.format(last.trend)}
              </text>
            </>
          )}
          {tip && <circle className="nf-trenddot" cx={x(tip.date)} cy={y(tip.trend)} r={4} />}
        </svg>
        {tip && (
          <div className="nf-tip" style={{ left: tipLeft, top: Math.max(8, Math.min(y(tip.kg), y(tip.trend)) - 12) }} role="status">
            <span className="nf-tip__date">{dayjs(tip.date).format("dddd D [de] MMMM")}</span>
            <span className="nf-tip__row">
              <i className="nf-tip__dot" />
              <b>{kg1.format(tip.kg)} kg</b> peso del día
            </span>
            <span className="nf-tip__row">
              <i className="nf-tip__line" />
              <b>{kg1.format(tip.trend)} kg</b> tendencia
            </span>
            {tip.source === "SHORTCUT" && <span className="nf-tip__date">Llegó de Apple Salud</span>}
          </div>
        )}
      </div>
    </div>
  );
}
