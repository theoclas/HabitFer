import { intText, kcalText, remaining } from "../math";
import type { MacroTargets, Totals } from "../types";

const R = 50;
const C = 2 * Math.PI * R;

/** Anillo de calorías: lo que queda para la meta (o lo comido si aún no hay meta). */
export function CalorieRing({ eaten, target }: { eaten: number; target: number | null }) {
  const over = target != null && eaten > target;
  const pct = target ? Math.min(1, eaten / target) : 0;
  const big = target ? Math.abs(remaining(target, eaten)) : Math.round(eaten);
  const label = target ? (over ? "kcal de más" : "kcal te quedan") : "kcal hoy";
  const aria = target
    ? `${kcalText(eaten)} de ${kcalText(target)} kilocalorías; ${over ? "te pasaste por" : "te quedan"} ${kcalText(big)}`
    : `${kcalText(eaten)} kilocalorías hoy`;
  return (
    <div className={`nf-ring${over ? " nf-ring--over" : ""}`}>
      <svg viewBox="0 0 120 120" role="img" aria-label={aria}>
        <circle className="nf-ring__track" cx="60" cy="60" r={R} fill="none" strokeWidth="11" />
        {pct > 0 && (
          <circle
            className="nf-ring__fill"
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${pct * C} ${C}`}
            transform="rotate(-90 60 60)"
          />
        )}
        <text className="nf-ring__big" x="60" y="62" textAnchor="middle">
          {kcalText(big)}
        </text>
        <text className="nf-ring__label" x="60" y="80" textAnchor="middle">
          {label}
        </text>
      </svg>
    </div>
  );
}

const MACROS: { key: "protein" | "carbs" | "fat"; label: string; cls: string }[] = [
  { key: "protein", label: "Proteína", cls: "nf-bar--protein" },
  { key: "carbs", label: "Carbohidratos", cls: "nf-bar--carbs" },
  { key: "fat", label: "Grasa", cls: "nf-bar--fat" },
];

/** Barras de proteína, carbohidratos y grasa contra la meta. */
export function MacroBars({ totals, targets }: { totals: Totals; targets: MacroTargets | null }) {
  return (
    <div className="nf-macros">
      {MACROS.map((m) => {
        const value = totals[m.key];
        const target = targets?.[m.key] ?? null;
        const pct = target ? Math.min(100, (value / target) * 100) : 0;
        return (
          <div className="nf-macro" key={m.key}>
            <div className="nf-macro__row">
              <span>{m.label}</span>
              <b>
                {intText(value)}
                {target ? ` / ${intText(target)}` : ""} g
              </b>
            </div>
            {target ? (
              <div
                className={`nf-bar ${m.cls}`}
                role="progressbar"
                aria-label={m.label}
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={Math.round(value)}
              >
                <i style={{ width: `${pct}%` }} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
