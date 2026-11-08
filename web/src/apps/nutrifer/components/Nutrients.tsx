import { WarningOutlined } from "@ant-design/icons";
import { gramsText, intText } from "../math";
import type { DayTargets, KnownNutrients, Totals } from "../types";

export type NutrientKey = "protein" | "carbs" | "fat" | "fiber" | "sugar" | "sodium";

/** Los seis de la meta: los macros son meta; la fibra, mínimo; el azúcar y el sodio, límite. */
export const NUTRIENTS: { key: NutrientKey; label: string; unit: "g" | "mg"; kind: "meta" | "mínimo" | "límite" }[] = [
  { key: "protein", label: "Proteína", unit: "g", kind: "meta" },
  { key: "carbs", label: "Carbohidratos", unit: "g", kind: "meta" },
  { key: "fat", label: "Grasa", unit: "g", kind: "meta" },
  { key: "fiber", label: "Fibra", unit: "g", kind: "mínimo" },
  { key: "sugar", label: "Azúcar", unit: "g", kind: "límite" },
  { key: "sodium", label: "Sodio", unit: "mg", kind: "límite" },
];

export const amountText = (value: number, unit: "g" | "mg") => (unit === "mg" ? intText(value) : gramsText(value));

type BarProps = {
  label: string;
  kind: "meta" | "mínimo" | "límite";
  value: number;
  target: number;
  unit: "g" | "mg";
  /** Clase del color (los macros tienen el suyo). */
  tone: string;
  /** El dato no está completo: cuántos alimentos lo traen. */
  note?: string | null;
  /** Sin ningún dato: se muestra «sin dato». */
  unknown?: boolean;
};

/** Una barra contra la meta. En un límite, pasarse se marca con un ícono y una frase (no solo con color). */
export function TargetBar({ label, kind, value, target, unit, tone, note, unknown }: BarProps) {
  const over = kind === "límite" && !unknown && value > target;
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className={`nf-macro${over ? " is-over" : ""}`}>
      <div className="nf-macro__row">
        <span>
          {label} <small className="nf-kind">{kind}</small>
        </span>
        <b>
          {unknown ? "sin dato" : amountText(value, unit)}
          {!unknown && ` / ${amountText(target, unit)} ${unit}`}
        </b>
      </div>
      <div
        className={`nf-bar nf-bar--thin ${over ? "nf-bar--over" : tone}`}
        role="progressbar"
        aria-label={`${label} (${kind})`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={unknown ? undefined : Math.round(value)}
        aria-valuetext={unknown ? "sin dato" : `${amountText(value, unit)} de ${amountText(target, unit)} ${unit}`}
      >
        {!unknown && <i style={{ width: `${pct}%` }} />}
      </div>
      {over && (
        <span className="nf-macro__note is-over">
          <WarningOutlined /> Pasaste el límite
        </span>
      )}
      {note && <span className="nf-macro__note">{note}</span>}
    </div>
  );
}

/** Fibra (mínimo), azúcar y sodio (límites) del día, diciendo cuándo el dato no está completo. */
export function NutrientBars({ totals, targets, known }: { totals: Totals; targets: DayTargets; known: KnownNutrients }) {
  const counted = known.entries;
  const rows = NUTRIENTS.filter((n) => n.key === "fiber" || n.key === "sugar" || n.key === "sodium");
  return (
    <section className="nf-card nf-nutricard" aria-labelledby="nf-nutri-title">
      <h2 id="nf-nutri-title" className="nf-nutricard__title">
        Fibra, azúcar y sodio
      </h2>
      <div className="nf-macros">
        {rows.map((n) => {
          const k = n.key as "fiber" | "sugar" | "sodium";
          const has = known[k];
          const unknown = counted > 0 && has === 0;
          let note: string | null = null;
          if (unknown) note = k === "sugar" ? "La tabla del ICBF no trae azúcar: cuenta lo de paquete y lo que crees con su tabla." : "Lo anotado hoy no trae este dato.";
          else if (counted > 0 && has < counted) note = `Dato de ${has} de ${counted} ${counted === 1 ? "alimento" : "alimentos"}.`;
          return (
            <TargetBar
              key={k}
              label={n.label}
              kind={n.kind}
              value={totals[k]}
              target={targets[k]}
              unit={n.unit}
              tone={k === "fiber" ? "nf-bar--fiber" : "nf-bar--limit"}
              unknown={unknown}
              note={note}
            />
          );
        })}
      </div>
    </section>
  );
}
