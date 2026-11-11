import { CaretRightOutlined, CheckOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { minutesText, weekdayName } from "../format";
import { FF_BASE } from "../layouts/FerFitShell";
import type { DayItem, DayPlan } from "../types";

type Props = {
  plan: DayPlan;
  date: string;
  today: string;
  busy: boolean;
  /** Pasar a hoy algo que quedó pendiente antes en la semana. */
  onBringToday: (item: DayItem & { date: string }) => void;
};

/** De dónde viene: «Programa · semana 2» o «Movida del martes». */
export function sourceText(i: DayItem): string {
  if (i.source === "program") return i.week ? `Programa · semana ${i.week}` : "Programa";
  if (i.source === "move" && i.movedFrom) return `Movida del ${weekdayName(i.movedFrom)}`;
  return "";
}

/** Hoy: lo que toca según la semana (plan o programa), con el botón para empezar, y lo que quedó pendiente. */
export function PlanTodayCard({ plan, date, today, busy, onBringToday }: Props) {
  const navigate = useNavigate();
  const isToday = date === today;
  const week = () => navigate(`${FF_BASE}/semana`);

  if (!plan.items.length && !plan.pending.length) {
    if (!isToday) return null;
    return plan.hasPlan ? (
      <section className="fit-card fit-plancard fit-plancard--rest" aria-label="Tu semana">
        <div className="fit-eyebrow">Tu semana</div>
        <div className="fit-h3">Hoy toca descanso</div>
        <span className="fit-hint">Descansar también es parte del plan. Si te provoca, una caminata suave cuenta.</span>
        <div className="fit-actions">
          <Button type="link" onClick={week} style={{ paddingInline: 0 }}>
            Ver mi semana
          </Button>
        </div>
      </section>
    ) : (
      <section className="fit-card fit-plancard" aria-label="Tu semana">
        <div className="fit-eyebrow">Tu semana</div>
        <div className="fit-h3">Arma tu semana</div>
        <span className="fit-hint">Escoge qué rutina toca cada día o sigue un programa de varias semanas, y te aviso el día que te toca.</span>
        <div className="fit-actions">
          <Button onClick={week}>Armar mi semana</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="fit-card fit-plancard" aria-labelledby="fit-plan-title">
      <div className="fit-section__head">
        <h2 className="fit-h2" id="fit-plan-title">
          {isToday ? "Hoy te toca" : "Ese día tocaba"}
        </h2>
        <Button type="link" onClick={week} style={{ paddingInline: 0 }}>
          Ver mi semana
        </Button>
      </div>
      {plan.items.map((i) => (
        <div key={`${i.routineId ?? i.readyKey}-${i.moveId ?? i.source}`} className={`fit-plan-item${i.doneOn ? " is-done" : ""}`}>
          <button type="button" className="fit-plan-item__body" onClick={() => navigate(i.path)}>
            <span className="fit-h3">
              {i.doneOn && <CheckOutlined className="fit-ok" />}
              {i.name}
            </span>
            <span className="fit-hint">{[i.minutes ? `Unos ${minutesText(i.minutes)}` : "", sourceText(i)].filter(Boolean).join(" · ")}</span>
          </button>
          {i.doneOn ? (
            <span className="fit-tag fit-tag--low">{i.doneOn === date ? "Hecha" : `Hecha el ${weekdayName(i.doneOn)}`}</span>
          ) : !i.exists ? (
            <span className="fit-hint">Ya no existe</span>
          ) : isToday ? (
            <Button type="primary" icon={<CaretRightOutlined />} onClick={() => navigate(`${i.path}/entrenar`)}>
              Empezar
            </Button>
          ) : (
            <span className="fit-tag">No se hizo</span>
          )}
        </div>
      ))}
      {plan.pending.map((p) => (
        <div key={`${p.date}-${p.routineId ?? p.readyKey}`} className="fit-plan-item fit-plan-item--pending">
          <div className="fit-plan-item__body">
            <span className="fit-h3">{p.name}</span>
            <span className="fit-hint">Te quedó pendiente del {weekdayName(p.date)}.</span>
          </div>
          <Button loading={busy} onClick={() => onBringToday(p)}>
            Pasarla a hoy
          </Button>
        </div>
      ))}
    </section>
  );
}
