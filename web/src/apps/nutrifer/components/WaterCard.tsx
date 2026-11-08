import { mlText } from "../math";
import type { WaterView } from "../types";

/** Un vaso con el agua hasta `level` (0 a 1). */
export function GlassIcon({ level }: { level: number }) {
  const l = Math.max(0, Math.min(1, level));
  const top = 21 - 16 * l;
  const left = (y: number) => 4 + (2.5 * (y - 3)) / 18;
  const right = (y: number) => 20 - (2.5 * (y - 3)) / 18;
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" className="nf-glass-icon">
      {l > 0 && <path className="nf-glass-icon__water" d={`M${left(top)} ${top}L${right(top)} ${top}L17.5 21L6.5 21Z`} />}
      <path className="nf-glass-icon__glass" d="M4 3L20 3L17.5 21L6.5 21Z" fill="none" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

type Props = {
  water: WaterView;
  busy: boolean;
  /** Sumar (o restar) mililitros. */
  onChange: (deltaMl: number) => void;
};

/** El agua del día: un toque por vaso (tocar el último vaso lleno lo quita). */
export function WaterCard({ water, busy, onChange }: Props) {
  const glass = water.glassMl > 0 ? water.glassMl : 250;
  const goal = Math.max(1, Math.min(16, Math.round(water.goalMl / glass)));
  const filled = Math.floor(water.ml / glass + 1e-6);
  const shown = Math.min(16, Math.max(goal, filled));
  const done = water.ml >= water.goalMl;

  return (
    <section className={`nf-water${done ? " is-done" : ""}`} aria-labelledby="nf-water-title">
      <div className="nf-water__head">
        <h2 className="nf-water__title" id="nf-water-title">
          Agua
        </h2>
        <span className="nf-water__amount" aria-live="polite">
          <b>{mlText(water.ml)}</b> de {mlText(water.goalMl)}
          {done && " · ¡meta cumplida!"}
        </span>
      </div>
      <div className="nf-water__glasses" role="group" aria-label={`Vasos de agua: ${filled} de ${goal}`}>
        {Array.from({ length: shown }, (_, i) => {
          const full = i < filled;
          const target = i + 1 === filled ? i : i + 1;
          return (
            <button
              key={i}
              type="button"
              className={`nf-glass${full ? " is-full" : ""}`}
              disabled={busy}
              aria-label={target < filled ? `Dejar ${target} ${target === 1 ? "vaso" : "vasos"}` : `Llevar a ${target} ${target === 1 ? "vaso" : "vasos"}`}
              onClick={() => onChange((target - filled) * glass)}
            >
              <GlassIcon level={full ? 1 : 0} />
            </button>
          );
        })}
      </div>
      <div className="nf-water__actions">
        <button type="button" className="nf-water__minus" disabled={busy || water.ml <= 0} onClick={() => onChange(-Math.min(glass, water.ml))} aria-label="Quitar un vaso">
          −
        </button>
        <button type="button" className="nf-water__plus" disabled={busy} onClick={() => onChange(glass)}>
          + Un vaso <small>({glass} ml)</small>
        </button>
      </div>
    </section>
  );
}
