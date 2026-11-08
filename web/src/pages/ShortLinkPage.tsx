import { LoadingOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { resolveShortLink } from "../api/client";
import "./action-page.css";

/**
 * /a/<código>: el enlace corto de los avisos por WhatsApp. Pide el token del enlace y abre la
 * misma confirmación de los correos (/accion), que nunca marca nada sin un toque.
 */
export function ShortLinkPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<{ title: string; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    resolveShortLink(code)
      .then((link) => {
        if (alive) navigate(`/accion#${new URLSearchParams({ t: link.t, n: link.n, l: link.l, s: "wa" }).toString()}`, { replace: true });
      })
      .catch((err) => {
        if (!alive) return;
        const status = (err as { response?: { status?: number } }).response?.status;
        setProblem(
          status === 410 || status === 404
            ? { title: "Enlace vencido", text: "Este enlace ya venció (duran 36 horas). Márcalo desde la app." }
            : status
              ? { title: "No se pudo abrir", text: "No se pudo abrir el enlace. Márcalo desde la app." }
              : { title: "Sin conexión", text: "Vuelve a tocar el enlace cuando tengas señal." },
        );
      });
    return () => {
      alive = false;
    };
  }, [code, navigate]);

  return (
    <main className="hf-action">
      <div className="hf-action__glow" aria-hidden="true" />
      <section className="hf-action__card">
        <div className="hf-action__brand">
          <span aria-hidden="true">🔥</span> HabitFer
        </div>
        {problem ? (
          <>
            <h1>{problem.title}</h1>
            <p role="alert">{problem.text}</p>
          </>
        ) : (
          <>
            <h1>Abriendo…</h1>
            <p aria-live="polite">
              <LoadingOutlined />
            </p>
          </>
        )}
        <Link className="hf-action__open" to="/app/habitfer">
          Abrir HabitFer
        </Link>
      </section>
    </main>
  );
}
