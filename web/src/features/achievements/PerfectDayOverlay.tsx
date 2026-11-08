import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Flame, PERFECT_STAGE } from "../../apps/habitfer/components/Flame";
import { buzz, playTick, prefersReducedMotion } from "../../apps/habitfer/effects";
import { pickFriendsPhrase } from "./phrases";

export type PerfectDayInfo = {
  done: number;
  total: number;
  /** Dias perfectos seguidos contando hoy. */
  streak: number;
  /** Colores de los habitos del dia: las brasas salen de esos colores. */
  colors: string[];
};

type Props = { info: PerfectDayInfo; onClose: () => void };

/** Brasas que suben desde abajo (no confeti que cae). */
function runEmbers(canvas: HTMLCanvasElement, colors: string[]) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  ctx.scale(dpr, dpr);
  const palette = [...colors, "#FF7A1A", "#FFD08A", "#4FD1E8", "#4FD1E8"];
  const count = Math.round(Math.min(180, (w * h) / 6000));
  const parts = Array.from({ length: count }, (_, i) => ({
    x: Math.random() * w,
    y: h + Math.random() * h * 0.7,
    vy: 1.4 + Math.random() * 3.4,
    r: 2 + Math.random() * 3.6,
    ph: Math.random() * Math.PI * 2,
    col: palette[i % palette.length],
    a: 0.55 + Math.random() * 0.45,
  }));
  const start = performance.now();
  let raf = 0;
  const frame = (t: number) => {
    const el = (t - start) / 1000;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    const fade = el > 3 ? Math.max(0, 1 - (el - 3) / 1.4) : 1;
    for (const p of parts) {
      p.y -= p.vy;
      p.x += Math.sin(el * 2 + p.ph) * 0.6;
      ctx.globalAlpha = p.a * fade * Math.max(0, Math.min(1, p.y / h + 0.3));
      ctx.fillStyle = p.col;
      ctx.shadowColor = p.col;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fade > 0) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, w, h);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

export function PerfectDayOverlay({ info, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const phrase = useMemo(() => pickFriendsPhrase(), []);

  useEffect(() => {
    btnRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    let stop: (() => void) | undefined;
    if (canvasRef.current && !prefersReducedMotion()) stop = runEmbers(canvasRef.current, info.colors);
    buzz([20, 60, 30]);
    playTick("perfect");
    return () => {
      window.removeEventListener("keydown", onKey);
      stop?.();
    };
  }, [info.colors, onClose]);

  return createPortal(
    <div className="hf-perfect" role="dialog" aria-modal="true" aria-label="Día perfecto" onClick={onClose}>
      <canvas ref={canvasRef} />
      <Flame stage={PERFECT_STAGE} size={84} glow />
      <h2>Día perfecto</h2>
      <p className="hf-perfect__sub">
        {info.done} de {info.total} hábitos
      </p>
      {info.streak > 1 && (
        <p className="hf-perfect__streak">
          <Flame stage={PERFECT_STAGE} size={16} /> {info.streak} días perfectos seguidos
        </p>
      )}
      <blockquote>{phrase.frase}</blockquote>
      <cite>{phrase.autor}</cite>
      <button ref={btnRef} type="button" className="hf-perfect__btn" onClick={onClose}>
        Seguir
      </button>
    </div>,
    document.body,
  );
}
