import { Button, Switch, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { fetchCoach, generateCoach, markCoachRead, setCoachEnabled } from "../../../api/client";
import type { CoachState } from "../../../types";
import { apiErrorMessage } from "../format";

type Props = {
  /** En Hoy solo aparece si hay algo nuevo; en Estadisticas siempre. */
  variant: "today" | "stats";
};

/** Mensaje semanal del coach (Claude). Sin llave en el servidor, en Hoy no se muestra. */
export function CoachCard({ variant }: Props) {
  const [state, setState] = useState<CoachState | null>(null);
  const [asking, setAsking] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    fetchCoach()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  if (!state || closed) return null;
  const msg = state.message;
  const thisWeek = msg && msg.weekStart === state.week;
  const weekday = dayjs().day(); // 0 domingo, 1 lunes

  if (variant === "today") {
    if (!state.enabled || !state.optedIn) return null;
    const fresh = thisWeek && !msg.readAt;
    const offer = state.canGenerate && (weekday === 0 || weekday === 1);
    if (!fresh && !offer) return null;
  }

  const ask = async () => {
    setAsking(true);
    try {
      const m = await generateCoach();
      setState((s) => (s ? { ...s, message: m, canGenerate: false } : s));
    } catch (err) {
      message.error(apiErrorMessage(err, "El coach no pudo escribir ahora. Intenta más tarde."));
    } finally {
      setAsking(false);
    }
  };

  const markRead = () => {
    if (msg && !msg.readAt) {
      void markCoachRead(msg.id).catch(() => undefined);
      setState((s) => (s && s.message ? { ...s, message: { ...s.message, readAt: new Date().toISOString() } } : s));
    }
  };

  const toggleOptIn = async (on: boolean) => {
    try {
      setState(await setCoachEnabled(on));
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    }
  };

  if (!state.enabled) {
    return variant === "stats" ? (
      <section className="hf-panel hf-coach is-off">
        <div className="hf-panel__head">
          <h2>Coach semanal</h2>
          <span>apagado</span>
        </div>
        <p className="hf-note" style={{ marginTop: 0 }}>
          Cada domingo Claude puede leer tu semana y escribirte un mensaje corto. Se activa en el servidor con una llave de API de Anthropic.
        </p>
      </section>
    ) : null;
  }

  return (
    <section className={`hf-coach${variant === "today" ? " hf-coach--today" : " hf-panel"}`} aria-label="Coach semanal">
      <div className="hf-coach__head">
        <span className="hf-coach__avatar" aria-hidden="true">
          🔥
        </span>
        <div>
          <b>Tu coach de la semana</b>
          <span>
            {msg ? `Semana del ${dayjs(msg.weekStart).format("D [de] MMMM")}` : "Cada domingo a las 7 p. m."}
          </span>
        </div>
        {variant === "stats" && (
          <label className="hf-coach__opt">
            <Switch size="small" checked={state.optedIn} onChange={(v) => void toggleOptIn(v)} />
            <span>{state.optedIn ? "Activo" : "Pausado"}</span>
          </label>
        )}
      </div>
      {msg && (variant === "stats" || thisWeek) ? (
        <div className="hf-coach__text">
          {msg.text.split(/\n{2,}|\n/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <p className="hf-note" style={{ marginTop: 6 }}>
          {state.optedIn ? "Todavía no hay mensaje de esta semana." : "No te va a escribir mientras esté pausado."}
        </p>
      )}
      <div className="hf-coach__actions">
        {state.canGenerate && (
          <Button type="primary" loading={asking} onClick={() => void ask()}>
            {asking ? "Escribiendo…" : msg ? "Pedir el de esta semana" : "Pedir mi primer mensaje"}
          </Button>
        )}
        {variant === "today" && thisWeek && (
          <Button
            onClick={() => {
              markRead();
              setClosed(true);
            }}
          >
            Listo
          </Button>
        )}
      </div>
    </section>
  );
}
