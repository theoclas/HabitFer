import { CheckOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { clock, effortText } from "../format";

export type FinishState = {
  status: "saving" | "saved" | "error" | "empty";
  /** Terminado antes de tiempo (con «Guardar y terminar»). */
  partial: boolean;
  activeMs: number;
  exercises: number;
  sets: number;
  workoutId?: string;
};

type Props = {
  state: FinishState | null;
  effort: number | null;
  effortSaved: boolean;
  onEffort: (n: number) => void;
  onRetry: () => void;
  onHome: () => void;
  onRoutine: () => void;
};

const STATUS_TEXT: Record<FinishState["status"], string> = {
  saving: "Guardando…",
  saved: "Guardado: cuenta para tu racha.",
  error: "No se pudo guardar.",
  empty: "No alcanzaste a hacer ejercicios de la rutina, así que no se anotó nada.",
};

/** Al terminar: el resumen, qué tan duro se sintió y volver. */
export function PlayerFinish({ state, effort, effortSaved, onEffort, onRetry, onHome, onRoutine }: Props) {
  const st: FinishState = state ?? { status: "saving", partial: false, activeMs: 0, exercises: 0, sets: 0 };
  const title = st.status === "empty" ? "Nada que anotar" : st.partial ? "¡Bien hecho!" : "¡Terminaste!";
  return (
    <div className="fit-player fit-player--finish">
      <div className="fit-finish">
        <div className="fit-finish__badge" aria-hidden="true">
          <CheckOutlined />
        </div>
        <h1 className="fit-title">{title}</h1>
        {st.status !== "empty" && (
          <div className="fit-stats">
            <div className="fit-stat">
              <b>{clock(st.activeMs, "down")}</b>
              <span>tiempo activo</span>
            </div>
            <div className="fit-stat">
              <b>{st.exercises}</b>
              <span>{st.exercises === 1 ? "ejercicio" : "ejercicios"}</span>
            </div>
            <div className="fit-stat">
              <b>{st.sets}</b>
              <span>{st.sets === 1 ? "serie" : "series"}</span>
            </div>
          </div>
        )}
        <p className="fit-hint fit-finish__status" role="status">
          {STATUS_TEXT[st.status]}{" "}
          {st.status === "error" && (
            <Button size="small" onClick={onRetry}>
              Reintentar
            </Button>
          )}
        </p>
        {st.status !== "empty" && (
          <section className="fit-card" aria-labelledby="fit-effort-title">
            <h2 className="fit-h3" id="fit-effort-title">
              ¿Qué tan duro se sintió?
            </h2>
            <div className="fit-effort" role="group" aria-labelledby="fit-effort-title">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" aria-pressed={effort === n} disabled={st.status !== "saved"} onClick={() => onEffort(n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="fit-effort__ends" aria-hidden="true">
              <span>1 · muy suave</span>
              <span>10 · al máximo</span>
            </div>
            {effort !== null && (
              <span className="fit-hint">
                {effortText(effort)}
                {effortSaved ? " · guardado" : ""}
              </span>
            )}
          </section>
        )}
        <div className="fit-actions fit-finish__actions">
          <Button type="primary" size="large" onClick={onHome}>
            Volver a Hoy
          </Button>
          <Button size="large" onClick={onRoutine}>
            Ver la rutina
          </Button>
        </div>
      </div>
    </div>
  );
}
