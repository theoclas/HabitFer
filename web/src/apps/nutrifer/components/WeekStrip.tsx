import { kcalText, weekdayLong, weekdayShort } from "../math";
import type { WeekDay } from "../types";

type Props = {
  week: WeekDay[];
  /** El día que se está viendo. */
  selected: string;
  today: string;
  target: number | null;
  onPick: (date: string) => void;
};

const PLOT = 76;

/** Los últimos 7 días en barras, con la línea de la meta; tocar un día lo abre. */
export function WeekStrip({ week, selected, today, target, onPick }: Props) {
  const logged = week.filter((d) => d.count > 0);
  const max = Math.max(target ? target * 1.15 : 0, ...week.map((d) => d.kcal), 1);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length) : 0;
  const near = target ? logged.filter((d) => Math.abs(d.kcal - target) <= target * 0.1).length : 0;

  return (
    <section className="nf-week" aria-labelledby="nf-week-title">
      <div className="nf-week__head">
        <h2 className="nf-week__title" id="nf-week-title">
          Últimos 7 días
        </h2>
        <span className="nf-week__avg">
          {logged.length ? (
            <>
              Promedio <b>{kcalText(avg)}</b> kcal
            </>
          ) : (
            "Aún sin datos"
          )}
        </span>
      </div>
      <div className="nf-week__grid" role="group" aria-label="Calorías por día">
        {target ? <i className="nf-week__goal" style={{ top: PLOT - (PLOT * target) / max }} aria-hidden="true" /> : null}
        {week.map((d) => {
          const h = d.kcal > 0 ? Math.max(6, (PLOT * d.kcal) / max) : 0;
          const over = target != null && d.kcal > target * 1.1;
          const sel = d.date === selected;
          return (
            <button
              key={d.date}
              type="button"
              className={`nf-week__day${sel ? " is-sel" : ""}`}
              aria-pressed={sel}
              aria-label={`${weekdayLong(d.date)}: ${kcalText(d.kcal)} kcal`}
              disabled={d.date > today}
              onClick={() => onPick(d.date)}
            >
              <span className="nf-week__bar" style={{ height: PLOT }}>
                <i className={over ? "is-over" : d.kcal > 0 ? "" : "is-empty"} style={{ height: h }} />
              </span>
              <span className="nf-week__label">
                {weekdayShort(d.date)}
                <b>{Number(d.date.slice(8, 10))}</b>
                <small className="nf-week__kcal">{d.kcal > 0 ? kcalText(d.kcal) : "—"}</small>
              </span>
            </button>
          );
        })}
      </div>
      {target && logged.length > 0 ? (
        <p className="nf-week__foot">
          {near} de {logged.length} {logged.length === 1 ? "día" : "días"} cerca de tu meta (±10 %)
        </p>
      ) : null}
    </section>
  );
}
