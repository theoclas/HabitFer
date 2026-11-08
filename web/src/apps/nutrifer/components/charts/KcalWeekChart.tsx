import dayjs from "dayjs";
import { useCallback, useRef, useState } from "react";
import { kcalText } from "../../math";
import { MEAL_ORDER, type MealSlot, type ReportDay } from "../../types";
import { niceTicks, topRoundedRect, useCloseOutside, useWidth } from "./chartUtils";

type Props = {
  days: ReportDay[];
  target: number | null;
  names: Record<MealSlot, string>;
  today: string;
};

const H = 232;
const M = { top: 18, right: 14, bottom: 40, left: 46 };
/** Espacio entre los pedazos de una barra (en el color del fondo). */
const GAP = 2;

const dayShort = (key: string) => dayjs(key).format("ddd").replace(".", "");

/**
 * Calorías de cada día, apiladas por comida (verde claro el desayuno → oscuro la comida, en orden del día),
 * con la línea de la meta. Tocar o pasar por un día muestra el detalle; también se puede ver como tabla.
 */
export function KcalWeekChart({ days, target, names, today }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const clear = useCallback(() => setActive(null), []);
  useCloseOutside(ref, active != null, clear);

  const plotW = Math.max(40, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const maxV = Math.max(target ?? 0, ...days.map((d) => d.kcal), 500);
  const { ticks, top } = niceTicks(maxV * 1.08);
  const y = (v: number) => M.top + plotH - (v / top) * plotH;
  const band = plotW / days.length;
  const barW = Math.min(24, band * 0.56);
  const empty = days.every((d) => d.kcal === 0);

  const tip = active == null ? null : days[active];
  const tipLeft = active == null ? 0 : Math.min(Math.max(M.left + band * active + band / 2, 92), width - 92);

  return (
    <div className="nf-chart" ref={ref}>
      <div className="nf-chart__bar">
        <ul className="nf-legend-row" aria-label="Comidas">
          {MEAL_ORDER.map((slot, i) => (
            <li key={slot}>
              <i className="nf-swatch" style={{ background: `var(--nf-meal-${i + 1})` }} />
              {names[slot]}
            </li>
          ))}
          {target != null && (
            <li>
              <i className="nf-swatch nf-swatch--line" />
              Meta
            </li>
          )}
        </ul>
        <button type="button" className="nf-link" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? "Ver gráfico" : "Ver tabla"}
        </button>
      </div>

      {asTable ? (
        <div className="nf-tablewrap">
          <table className="nf-ntable nf-ntable--wide">
            <caption className="nf-sr">Calorías por día y por comida</caption>
            <thead>
              <tr>
                <th scope="col">Día</th>
                {MEAL_ORDER.map((slot) => (
                  <th scope="col" key={slot}>
                    {names[slot]}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <th scope="row">{dayjs(d.date).format("ddd D")}</th>
                  {MEAL_ORDER.map((slot) => (
                    <td key={slot}>{d.meals[slot] ? kcalText(d.meals[slot]) : "—"}</td>
                  ))}
                  <td>
                    <b>{d.kcal ? kcalText(d.kcal) : "—"}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="nf-chart__plot"
          onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setActive(null)}
        >
          {empty && <p className="nf-chart__empty">Aún no hay nada anotado en estos días.</p>}
          <svg width={width} height={H} role="group" aria-label="Calorías por día y por comida">
            {ticks.map((t) => (
              <g key={t}>
                <line className="nf-grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
                <text className="nf-axis" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                  {kcalText(t)}
                </text>
              </g>
            ))}
            {days.map((d, i) => {
              const cx = M.left + band * i + band / 2;
              const x = cx - barW / 2;
              let cum = 0;
              const parts = MEAL_ORDER.map((slot, k) => ({ slot, k, v: d.meals[slot] })).filter((p) => p.v > 0);
              const dim = active != null && active !== i;
              return (
                <g key={d.date} className={`nf-col-g${dim ? " is-dim" : ""}`}>
                  {parts.map((p, j) => {
                    const yTop = y(cum + p.v);
                    const yBottom = y(cum);
                    cum += p.v;
                    const h = Math.max(0, yBottom - yTop - (j === 0 ? 0 : GAP));
                    if (h <= 0) return null;
                    const fill = `var(--nf-meal-${p.k + 1})`;
                    return j === parts.length - 1 ? (
                      <path key={p.slot} d={topRoundedRect(x, yTop, barW, h, 4)} style={{ fill }} />
                    ) : (
                      <rect key={p.slot} x={x} y={yTop} width={barW} height={h} style={{ fill }} />
                    );
                  })}
                  <text className={`nf-axis nf-axis--x${d.date === today ? " is-today" : ""}`} x={cx} y={H - M.bottom + 16} textAnchor="middle">
                    {dayShort(d.date)}
                  </text>
                  <text className={`nf-axis nf-axis--x${d.date === today ? " is-today" : ""}`} x={cx} y={H - M.bottom + 30} textAnchor="middle">
                    {dayjs(d.date).format("D")}
                  </text>
                  {/* Toque y foco: la columna entera, más grande que la barra. */}
                  <rect
                    className="nf-hit"
                    x={M.left + band * i}
                    y={M.top}
                    width={band}
                    height={plotH + M.bottom}
                    tabIndex={0}
                    role="img"
                    aria-label={`${dayjs(d.date).format("dddd D")}: ${d.kcal ? `${kcalText(d.kcal)} kcal` : "nada anotado"}`}
                    onPointerEnter={() => setActive(i)}
                    onPointerDown={() => setActive(i)}
                    onFocus={() => setActive(i)}
                  />
                </g>
              );
            })}
            <line className="nf-baseline" x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} />
            {target != null && (
              <g className="nf-target" aria-hidden="true">
                <line x1={M.left} x2={width - M.right} y1={y(target)} y2={y(target)} />
                <text x={width - M.right} y={y(target) - 6} textAnchor="end">
                  Meta {kcalText(target)}
                </text>
              </g>
            )}
          </svg>
          {tip && (
            <div className="nf-tip" style={{ left: tipLeft, top: Math.max(8, y(tip.kcal) - 10) }} role="status">
              <b>{tip.kcal ? `${kcalText(tip.kcal)} kcal` : "Nada anotado"}</b>
              <span className="nf-tip__date">{dayjs(tip.date).format("dddd D [de] MMMM")}</span>
              {tip.kcal > 0 &&
                MEAL_ORDER.filter((slot) => tip.meals[slot] > 0).map((slot) => (
                  <span key={slot} className="nf-tip__row">
                    <i style={{ background: `var(--nf-meal-${MEAL_ORDER.indexOf(slot) + 1})` }} />
                    <b>{kcalText(tip.meals[slot])}</b> {names[slot]}
                  </span>
                ))}
              {target != null && tip.kcal > 0 && (
                <span className="nf-tip__date">
                  {tip.kcal > target ? `${kcalText(tip.kcal - target)} por encima de la meta` : `${kcalText(target - tip.kcal)} por debajo de la meta`}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
