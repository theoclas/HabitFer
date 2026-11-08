import { AppleFilled, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { Button, InputNumber, Segmented, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { deleteWeight, saveWeight } from "../api";
import type { WeightsView } from "../types";
import { AppleHealthDrawer } from "./AppleHealthDrawer";
import { WeightChart } from "./charts/WeightChart";

export type WeightRange = 30 | 90 | 3650;

type Props = {
  data: WeightsView | null;
  range: WeightRange;
  onRange: (r: WeightRange) => void;
  /** Cambió una pesada o el atajo: recargar el peso y lo que depende de él. */
  onChanged: () => void;
};

const kg1 = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${kg1.format(Math.abs(n))}`;

/** El peso: anotarlo, la tendencia (lo que importa) y las pesadas de cada día. */
export function WeightCard({ data, range, onRange, onChanged }: Props) {
  const today = data?.today ?? dayjs().format("YYYY-MM-DD");
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [appleOpen, setAppleOpen] = useState(false);
  const points = data?.points ?? [];
  const summary = data?.summary ?? null;
  const onDate = points.find((p) => p.date === date);

  // Al cambiar de día (o al llegar los datos), el cuadro muestra lo anotado ese día.
  useEffect(() => {
    setKg(onDate ? onDate.kg : null);
  }, [date, onDate?.kg]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (kg == null) return;
    setBusy(true);
    try {
      await saveWeight(date, kg);
      message.success(date === today ? "Peso de hoy anotado" : `Peso del ${dayjs(date).format("D [de] MMMM")} anotado`);
      onChanged();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar el peso"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: string) => {
    try {
      await deleteWeight(d);
      message.success("Pesada borrada");
      onChanged();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo borrar"));
    }
  };

  // El eje arranca en el rango elegido, pero no antes de un par de días antes de la primera pesada (sin espacio vacío).
  const rangeFrom = range === 3650 ? (points[0]?.date ?? today) : dayjs(today).subtract(range, "day").format("YYYY-MM-DD");
  const firstMinus = points[0] ? dayjs(points[0].date).subtract(2, "day").format("YYYY-MM-DD") : rangeFrom;
  const from = firstMinus > rangeFrom ? firstMinus : rangeFrom;

  return (
    <section className="nf-card nf-weight" aria-labelledby="nf-weight-title">
      <div className="nf-card__head">
        <h2 id="nf-weight-title">Peso</h2>
        <Segmented
          size="small"
          value={range}
          onChange={(v) => onRange(v as WeightRange)}
          options={[
            { label: "30 días", value: 30 },
            { label: "90 días", value: 90 },
            { label: "Todo", value: 3650 },
          ]}
        />
      </div>

      {summary ? (
        <div className="nf-stats">
          <div className="nf-stat nf-stat--hero">
            <span>Tendencia</span>
            <b>
              {kg1.format(summary.trend)} <small>kg</small>
            </b>
          </div>
          <div className="nf-stat">
            <span>En 7 días</span>
            <b>{summary.change7 == null ? "—" : `${signed(summary.change7)} kg`}</b>
          </div>
          <div className="nf-stat">
            <span>Ritmo</span>
            <b>{summary.weeklyRate == null ? "—" : `${signed(summary.weeklyRate)} kg/sem`}</b>
          </div>
        </div>
      ) : (
        <p className="nf-hint" style={{ margin: 0 }}>
          Anota tu peso unos días (mejor en la mañana, antes de comer) y aquí ves la tendencia real, sin los saltos por agua o sal.
        </p>
      )}

      <form
        className="nf-weight__form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="nf-label" htmlFor="nf-weight-kg">
          {date === today ? "Tu peso de hoy" : `Peso del ${dayjs(date).format("D [de] MMMM")}`}
        </label>
        <div className="nf-weight__row">
          <InputNumber
            id="nf-weight-kg"
            size="large"
            min={25}
            max={350}
            step={0.1}
            precision={1}
            decimalSeparator=","
            inputMode="decimal"
            value={kg}
            placeholder={summary ? kg1.format(summary.kg) : "72,5"}
            onChange={(v) => setKg(typeof v === "number" ? v : null)}
            suffix="kg"
          />
          <input
            type="date"
            className="nf-date nf-date--lg"
            value={date}
            max={today}
            aria-label="Día de la pesada"
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <Button type="primary" size="large" htmlType="submit" loading={busy} disabled={kg == null || kg === onDate?.kg}>
            {onDate ? "Cambiar" : "Guardar"}
          </Button>
        </div>
      </form>

      {points.length >= 2 ? (
        <WeightChart points={points} from={from} to={today} />
      ) : points.length === 1 ? (
        <p className="nf-hint" style={{ margin: 0 }}>
          Con una pesada más ya se ve la línea.
        </p>
      ) : null}

      {points.length > 0 && (
        <details className="nf-more">
          <summary>Pesadas ({points.length})</summary>
          <ul className="nf-wlist">
            {[...points]
              .reverse()
              .slice(0, 60)
              .map((p) => (
                <li key={p.date}>
                  <span className="nf-wlist__date">{dayjs(p.date).format("ddd D MMM").replace(/\./g, "")}</span>
                  <b>{kg1.format(p.kg)} kg</b>
                  <span className="nf-wlist__trend">tendencia {kg1.format(p.trend)}</span>
                  {p.source === "SHORTCUT" ? <AppleFilled aria-label="Llegó de Apple Salud" title="Llegó de Apple Salud" /> : <span />}
                  <span className="nf-wlist__tools">
                    <button type="button" className="nf-icon-btn nf-icon-btn--sm" aria-label={`Cambiar el peso del ${p.date}`} onClick={() => setDate(p.date)}>
                      <EditOutlined />
                    </button>
                    <button type="button" className="nf-icon-btn nf-icon-btn--sm" aria-label={`Borrar el peso del ${p.date}`} onClick={() => void remove(p.date)}>
                      <DeleteOutlined />
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </details>
      )}

      <button type="button" className="nf-applelink" onClick={() => setAppleOpen(true)}>
        <AppleFilled />
        <span>
          {data?.shortcut
            ? data.shortcut.lastUsedAt
              ? `Apple Salud conectado · último peso ${dayjs(data.shortcut.lastUsedAt).format("D MMM, h:mm a")}`
              : "Apple Salud conectado · aún no ha llegado nada"
            : "Mandar el peso desde Apple Salud"}
        </span>
      </button>
      <AppleHealthDrawer open={appleOpen} shortcut={data?.shortcut ?? null} onClose={() => setAppleOpen(false)} onChanged={onChanged} />
    </section>
  );
}
