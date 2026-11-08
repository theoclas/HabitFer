import { BulbOutlined, CheckCircleOutlined, EyeOutlined } from "@ant-design/icons";
import { Button, Skeleton } from "antd";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { kcalText } from "../math";
import type { Discovery, EnergyView, Insights } from "../types";

const TONE_ICON: Record<Discovery["tone"], { icon: ReactNode; label: string }> = {
  good: { icon: <CheckCircleOutlined />, label: "Buena noticia" },
  watch: { icon: <EyeOutlined />, label: "Para mirar" },
  neutral: { icon: <BulbOutlined />, label: "Dato" },
};

/** Frases que salen solas de las últimas 4 semanas. */
export function DiscoveriesCard({ insights }: { insights: Insights | null }) {
  const d = insights?.discoveries;
  return (
    <section className="nf-card nf-discoveries" aria-labelledby="nf-disc-title">
      <div className="nf-card__head">
        <h2 id="nf-disc-title">Descubrimientos</h2>
        {d && <span className="nf-hint">Últimas 4 semanas · {d.loggedDays} días anotados</span>}
      </div>
      {!d ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : d.items.length === 0 ? (
        <p className="nf-empty" style={{ textAlign: "left", padding: "4px 0" }}>
          Con unas dos semanas anotando salen los primeros: si comes más los fines de semana, qué comida pesa más en tu día, cómo vas con la
          proteína o la fibra…
        </p>
      ) : (
        <ul className="nf-disc">
          {d.items.map((item) => (
            <li key={item.id} className={`nf-disc__item nf-disc__item--${item.tone}`}>
              <span className="nf-disc__icon" role="img" aria-label={TONE_ICON[item.tone].label}>
                {TONE_ICON[item.tone].icon}
              </span>
              <div>
                <p>{item.text}</p>
                <small>{item.detail}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Meter({ label, value, need }: { label: string; value: number; need: number }) {
  const pct = Math.min(100, (value / need) * 100);
  return (
    <div className="nf-macro">
      <div className="nf-macro__row">
        <span>{label}</span>
        <b>
          {Math.min(value, need)} de {need}
        </b>
      </div>
      <div className="nf-bar nf-bar--thin nf-bar--fiber" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(value, need)}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Cuánto gastas de verdad (con tu peso y lo que comes) y cómo se ajusta la meta cada semana. */
export function EnergyCard({ energy, loaded }: { energy: EnergyView | null; loaded: boolean }) {
  const navigate = useNavigate();
  const goMeta = () => navigate("/app/nutrifer/meta");
  const live = energy?.live;
  return (
    <section className="nf-card nf-energy" id="gasto" aria-labelledby="nf-energy-title">
      <div className="nf-card__head">
        <h2 id="nf-energy-title">Tu gasto real</h2>
        {energy && !energy.manual && energy.adaptive && <span className="nf-hint">Próxima revisión: {dayjs(energy.nextReview).format("dddd D")}</span>}
      </div>
      {!loaded ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : !energy ? (
        <div className="nf-detail" style={{ gap: 12 }}>
          <p className="nf-hint" style={{ margin: 0 }}>
            Primero arma tu meta: con ella y tu peso, NutriFer mide cuánto gastas de verdad.
          </p>
          <Button type="primary" onClick={goMeta}>
            Calcular mi meta
          </Button>
        </div>
      ) : energy.manual ? (
        <p className="nf-hint" style={{ margin: 0 }}>
          Tus metas están puestas a mano, así que no se ajustan solas. Puedes cambiar eso en <button type="button" className="nf-link" onClick={goMeta}>Meta</button>.
        </p>
      ) : !energy.adaptive ? (
        <p className="nf-hint" style={{ margin: 0 }}>
          La meta que se ajusta sola está apagada: la meta sale solo de la fórmula. Se prende en{" "}
          <button type="button" className="nf-link" onClick={goMeta}>
            Meta
          </button>
          .
        </p>
      ) : live && live.status === "ready" && live.observed != null ? (
        <div className="nf-detail" style={{ gap: 14 }}>
          <div className="nf-energy__hero">
            <b>
              {kcalText(live.observed)} <small>kcal al día</small>
            </b>
            <span>
              es lo que gastas según tu peso y lo que comes ({live.spanDays} días medidos). La fórmula decía {kcalText(live.formula)}.
            </span>
          </div>
          <p className="nf-hint" style={{ margin: 0 }}>
            Para la meta se usan {kcalText(live.tdee)} kcal: {Math.round(live.confidence * 100)} % lo medido y el resto la fórmula (con 4 semanas cuenta
            todo lo medido). La meta nunca se mueve más de 150 kcal por semana.
          </p>
        </div>
      ) : live ? (
        <div className="nf-detail" style={{ gap: 14 }}>
          <p style={{ margin: 0 }}>
            <b>Midiendo.</b> Con tu peso de tendencia y lo que comes, NutriFer calcula cuánto gastas de verdad y ajusta la meta cada lunes. Mientras
            tanto se usa la fórmula: {kcalText(live.formula)} kcal.
          </p>
          <div className="nf-macros">
            <Meter label="Pesadas en las últimas 4 semanas" value={live.weighIns} need={3} />
            <Meter label="Días entre la primera y la última pesada" value={live.spanDays} need={14} />
            <Meter label="Días con la comida completa" value={live.loggedDays} need={10} />
          </div>
          <p className="nf-hint" style={{ margin: 0 }}>
            Un día cuenta si lo anotado llega a la mitad de lo que gastas (si no, seguro faltó algo). Hacen falta unas dos semanas.
          </p>
        </div>
      ) : null}

      {energy && energy.history.length > 0 && (
        <details className="nf-more">
          <summary>Revisiones de la meta ({energy.history.length})</summary>
          <table className="nf-ntable">
            <caption className="nf-sr">Revisiones semanales de la meta</caption>
            <thead>
              <tr>
                <th scope="col">Semana</th>
                <th scope="col">Gasto usado</th>
                <th scope="col">Meta</th>
              </tr>
            </thead>
            <tbody>
              {energy.history.map((h) => (
                <tr key={h.weekStart}>
                  <th scope="row">{dayjs(h.weekStart).format("D MMM").replace(".", "")}</th>
                  <td>
                    {kcalText(h.tdee)}
                    <small className="nf-kind">{h.observed != null ? "medido" : "fórmula"}</small>
                  </td>
                  <td>
                    {kcalText(h.kcalTarget)}
                    {h.kcalTarget !== h.kcalBefore && <small className="nf-kind">antes {kcalText(h.kcalBefore)}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
