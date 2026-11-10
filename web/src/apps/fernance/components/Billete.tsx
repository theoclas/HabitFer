import { useEffect, useRef, type ReactNode } from "react";

/** Guilloché: las curvas finas de los billetes, dibujadas en el fondo de la tarjeta. */
function drawGuilloche(canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("--ff-bill-oro").trim() || "#E2C15A";
  ctx.lineWidth = 0.6;
  // Ondas entrelazadas a lo ancho.
  ctx.globalAlpha = 0.14;
  for (let k = 0; k < 10; k++) {
    ctx.beginPath();
    for (let x = 0; x <= r.width; x += 2) {
      const y = r.height * 0.78 + Math.sin(x / 17 + k * 0.7) * (10 + k) + Math.sin(x / 47 + k) * 7;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Roseta (hipotrocoide) arriba a la derecha.
  const size = Math.min(56, r.height * 0.42);
  const cx = r.width - size - 14;
  const cy = size + 10;
  const R = size * 0.82;
  const rr = R * 0.37;
  const d = R * 0.63;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  for (let t = 0; t <= Math.PI * 2 * 14; t += 0.02) {
    const x = cx + (R - rr) * Math.cos(t) + d * Math.cos(((R - rr) / rr) * t);
    const y = cy + (R - rr) * Math.sin(t) - d * Math.sin(((R - rr) / rr) * t);
    if (t === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

type Props = {
  label: string;
  amount: string;
  negative?: boolean;
  children?: ReactNode;
};

/** La tarjeta principal del resumen: un billete oscuro con su guilloché, en los dos temas. */
export function Billete({ label, amount, negative = false, children }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    drawGuilloche(canvas);
    if (!window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(() => drawGuilloche(canvas));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <section className="ff-billete" aria-label={`${label}: ${amount}`}>
      <canvas ref={ref} aria-hidden="true" />
      <span className="ff-billete__label">{label}</span>
      <span className={`ff-billete__amount${negative ? " is-negative" : ""}`}>{amount}</span>
      {children}
    </section>
  );
}
