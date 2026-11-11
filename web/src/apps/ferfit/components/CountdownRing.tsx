import type { ReactNode } from "react";
import { clock } from "../format";

const R = 44;
const C = 2 * Math.PI * R;

/** La cuenta regresiva: un anillo que se vacía y los segundos en grande (minutos:segundos desde 1 minuto). */
export function CountdownRing({ leftMs, totalMs, sub }: { leftMs: number; totalMs: number; sub?: ReactNode }) {
  const frac = totalMs > 0 ? Math.min(1, Math.max(0, leftMs / totalMs)) : 0;
  const secs = Math.ceil(leftMs / 1000);
  return (
    <div className="fit-ring" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <circle className="fit-ring__track" cx="50" cy="50" r={R} />
        <circle className="fit-ring__fill" cx="50" cy="50" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
      </svg>
      <div className="fit-ring__center">
        <span className="fit-ring__num">{secs >= 60 ? clock(leftMs) : secs}</span>
        {sub ? <span className="fit-ring__sub">{sub}</span> : null}
      </div>
    </div>
  );
}
