import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Skeleton } from "antd";
import dayjs from "dayjs";
import { intText, kcalText } from "../math";
import { MEAL_ORDER, type Report } from "../types";
import { KcalWeekChart } from "./charts/KcalWeekChart";
import { NUTRIENTS, TargetBar } from "./Nutrients";

type Props = {
  report: Report | null;
  /** Cargando otra semana: se deja la anterior a media luz (sin saltos). */
  loading: boolean;
  isCurrent: boolean;
  onShift: (weeks: number) => void;
  onToday: () => void;
};

const TONE: Record<string, string> = {
  protein: "nf-bar--protein",
  carbs: "nf-bar--carbs",
  fat: "nf-bar--fat",
  fiber: "nf-bar--fiber",
  sugar: "nf-bar--limit",
  sodium: "nf-bar--limit",
};

function rangeText(from: string, to: string) {
  const a = dayjs(from);
  const b = dayjs(to);
  return a.month() === b.month() ? `${a.format("D")} al ${b.format("D [de] MMMM")}` : `${a.format("D [de] MMM")} al ${b.format("D [de] MMM")}`;
}

const pct = (share: number) => `${Math.round(share * 100)} %`;

/** El informe de una semana (lunes a domingo): promedios, días en meta, cada día por comida y lo que más aportó. */
export function WeekReport({ report, loading, isCurrent, onShift, onToday }: Props) {
  const r = report;
  const t = r?.targets ?? null;
  const s = r?.summary;
  const totalKcal = r?.meals.reduce((sum, m) => sum + m.kcal, 0) ?? 0;
  const topMax = r?.topFoods[0]?.kcal ?? 0;
  const daysSoFar = r ? r.days.filter((d) => d.date <= r.today).length : 7;

  return (
    <section className="nf-card nf-wreport" aria-labelledby="nf-wreport-title">
      <div className="nf-card__head">
        <h2 id="nf-wreport-title">Semana</h2>
        <div className="nf-weeknav">
          <Button shape="circle" icon={<LeftOutlined />} aria-label="Semana anterior" onClick={() => onShift(-1)} />
          <span className="nf-weeknav__label">{r ? rangeText(r.from, r.to) : "…"}</span>
          <Button shape="circle" icon={<RightOutlined />} aria-label="Semana siguiente" disabled={isCurrent} onClick={() => onShift(1)} />
          {!isCurrent && (
            <button type="button" className="nf-link" onClick={onToday}>
              Esta semana
            </button>
          )}
        </div>
      </div>

      {!r ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <div className={`nf-wreport__body${loading ? " is-loading" : ""}`}>
          <div className="nf-stats nf-stats--4">
            <div className="nf-stat">
              <span>Promedio al día</span>
              <b>{s?.avg ? `${kcalText(s.avg.kcal)} kcal` : "—"}</b>
              {t && <small>meta {kcalText(t.kcal)}</small>}
            </div>
            <div className="nf-stat">
              <span>Días en meta</span>
              <b>{s?.inTarget == null ? "—" : `${s.inTarget} de ${s.logged}`}</b>
              <small>a ±10 % de la meta</small>
            </div>
            <div className="nf-stat">
              <span>Proteína</span>
              <b>{s?.avg ? `${intText(s.avg.protein)} g` : "—"}</b>
              {t && <small>meta {intText(t.protein)} g</small>}
            </div>
            <div className="nf-stat">
              <span>Días anotados</span>
              <b>
                {s?.logged ?? 0} de {daysSoFar}
              </b>
              <small>{isCurrent ? "en lo que va" : "de la semana"}</small>
            </div>
          </div>

          <KcalWeekChart days={r.days} target={t?.kcal ?? null} names={r.mealNames} today={r.today} />

          {s?.avg && t && (
            <div className="nf-wreport__block">
              <h3 className="nf-subtitle">Promedios contra la meta</h3>
              <div className="nf-macros nf-macros--2">
                {NUTRIENTS.map((n) => (
                  <TargetBar
                    key={n.key}
                    label={n.label}
                    kind={n.kind}
                    value={s.avg![n.key]}
                    target={t[n.key]}
                    unit={n.unit}
                    tone={TONE[n.key]}
                    note={n.key === "sugar" ? "Parcial: la tabla del ICBF no trae azúcar." : null}
                  />
                ))}
              </div>
            </div>
          )}

          {totalKcal > 0 && (
            <div className="nf-wreport__block">
              <h3 className="nf-subtitle">Por comida</h3>
              <div className="nf-mealsplit" role="img" aria-label={r.meals.map((m) => `${m.name} ${pct(m.share)}`).join(", ")}>
                {MEAL_ORDER.map((slot, i) => {
                  const m = r.meals.find((x) => x.slot === slot);
                  return m && m.share > 0 ? <i key={slot} style={{ flexGrow: m.share, background: `var(--nf-meal-${i + 1})` }} /> : null;
                })}
              </div>
              <ul className="nf-splitlist">
                {MEAL_ORDER.map((slot, i) => {
                  const m = r.meals.find((x) => x.slot === slot);
                  if (!m) return null;
                  return (
                    <li key={slot}>
                      <i className="nf-swatch" style={{ background: `var(--nf-meal-${i + 1})` }} />
                      <span>{m.name}</span>
                      <b>{pct(m.share)}</b>
                      <small>{s && s.logged > 0 ? `${kcalText(m.kcal / s.logged)} kcal/día` : ""}</small>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {r.topFoods.length > 0 && (
            <div className="nf-wreport__block">
              <h3 className="nf-subtitle">Lo que más calorías te aportó</h3>
              <ol className="nf-toplist">
                {r.topFoods.map((f) => (
                  <li key={(f.foodId ?? "") + f.name}>
                    <div className="nf-toplist__row">
                      <span>{f.name.split(",")[0]}</span>
                      <b>{kcalText(f.kcal)} kcal</b>
                    </div>
                    <div className="nf-toplist__meter" aria-hidden="true">
                      <i style={{ width: `${topMax ? (f.kcal / topMax) * 100 : 0}%` }} />
                    </div>
                    <small>
                      {f.times} {f.times === 1 ? "vez" : "veces"} · {pct(f.share)} de lo de la semana
                    </small>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
