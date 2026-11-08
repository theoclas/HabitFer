import { CheckOutlined, LoadingOutlined, ReloadOutlined } from "@ant-design/icons";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { runPushAction } from "../api/client";
import { defaultLabel, describeResult, parseActionHash, type ActionLink } from "../apps/habitfer/actionLink";
import { apiErrorMessage, friendlyDay } from "../apps/habitfer/format";
import { todayKey } from "../utils/dates";
import "./action-page.css";

type Phase =
  | { kind: "ask" }
  | { kind: "busy" }
  | { kind: "done"; title: string; body: string; trophy: boolean }
  | { kind: "error"; text: string; retry: boolean };

const EXPIRED = "Este enlace ya venció (duran 36 horas). Márcalo desde la app.";

/** «de hoy», «de ayer», «del lunes 20». */
function dayPhrase(day: string): string {
  return day.startsWith("el ") ? `del ${day.slice(3)}` : `de ${day}`;
}

function question(link: ActionLink): string {
  if (link.act === "task-done") return "¿Ya la hiciste? Márcala con un toque.";
  const day = link.date ? friendlyDay(link.date, todayKey()) : "hoy";
  if (link.act === "habit-add") return `Súmale a tu avance ${dayPhrase(day)}.`;
  return day === "hoy" ? "¿Ya lo hiciste hoy? Márcalo con un toque." : `¿Lo hiciste ${day}? Márcalo con un toque.`;
}

/**
 * /accion: el botón «Hecho» de los correos. Nunca marca solo al abrir: los revisores de enlaces
 * de algunos correos abren las páginas por su cuenta, así que siempre pide un toque.
 */
export function ActionPage() {
  const [link, setLink] = useState(() => parseActionHash(window.location.hash));
  const [phase, setPhase] = useState<Phase>({ kind: "ask" });

  // Otro enlace abierto en la misma pestaña solo cambia el fragmento: se vuelve a leer.
  useEffect(() => {
    const onHash = () => {
      setLink(parseActionHash(window.location.hash));
      setPhase({ kind: "ask" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = link?.title ? `${link.title} · HabitFer` : "HabitFer";
    return () => {
      document.title = previous;
    };
  }, [link]);

  const confirm = async () => {
    if (!link || phase.kind === "busy") return;
    setPhase({ kind: "busy" });
    try {
      const result = await runPushAction(link.token);
      if (result.ok) setPhase({ kind: "done", ...describeResult(result) });
      else setPhase({ kind: "error", text: result.message || "No se pudo marcar. Ábrelo en HabitFer.", retry: false });
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 401) setPhase({ kind: "error", text: EXPIRED, retry: false });
      else if (!status) setPhase({ kind: "error", text: "Sin conexión. Inténtalo de nuevo cuando tengas señal.", retry: true });
      else setPhase({ kind: "error", text: apiErrorMessage(err, "No se pudo marcar. Ábrelo en HabitFer."), retry: status >= 500 || status === 429 });
    }
  };

  let content: ReactNode;
  if (!link) {
    content = (
      <>
        <h1>Enlace incompleto</h1>
        <p>Ábrelo otra vez desde el correo, o entra a HabitFer para marcarlo.</p>
      </>
    );
  } else if (phase.kind === "done") {
    content = (
      <>
        <div className={`hf-action__mark${phase.trophy ? " is-trophy" : ""}`} aria-hidden="true">
          {phase.trophy ? "🏆" : <CheckOutlined />}
        </div>
        <h1>{phase.title}</h1>
        <p role="status">{phase.body}</p>
      </>
    );
  } else {
    const title = link.title || (link.act === "task-done" ? "Tu tarea" : "Tu hábito");
    const expired = link.expired && phase.kind === "ask";
    const showButton = !expired && (phase.kind !== "error" || phase.retry);
    const busy = phase.kind === "busy";
    content = (
      <>
        <p className="hf-action__kicker">Desde tu correo</p>
        <h1>{title}</h1>
        {expired ? (
          <p role="alert">{EXPIRED}</p>
        ) : phase.kind === "error" ? (
          <p role="alert" className="hf-action__error">
            {phase.text}
          </p>
        ) : (
          <p>{question(link)}</p>
        )}
        {showButton && (
          <button type="button" className="hf-action__btn" onClick={() => void confirm()} disabled={busy} aria-busy={busy}>
            {busy ? <LoadingOutlined /> : phase.kind === "error" ? <ReloadOutlined /> : <CheckOutlined />}
            {busy ? "Marcando…" : phase.kind === "error" ? "Intentar de nuevo" : link.label || defaultLabel(link.act)}
          </button>
        )}
      </>
    );
  }

  return (
    <main className="hf-action">
      <div className="hf-action__glow" aria-hidden="true" />
      <section className="hf-action__card">
        <div className="hf-action__brand">
          <span aria-hidden="true">🔥</span> HabitFer
        </div>
        {content}
        <Link className="hf-action__open" to="/app/habitfer">
          Abrir HabitFer
        </Link>
      </section>
    </main>
  );
}
