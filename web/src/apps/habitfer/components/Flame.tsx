import type { CSSProperties } from "react";

export type FlameStage = {
  id: "chispa" | "llama" | "fuego" | "azul" | "fenix";
  name: string;
  min: number;
  outer: string;
  inner: string;
};

/** Escala de la racha: la llama cambia con los dias. El azul es el fuego mas caliente. */
export const FLAME_STAGES: FlameStage[] = [
  { id: "chispa", name: "Chispa", min: 1, outer: "#FBBF24", inner: "#FEF3C7" },
  { id: "llama", name: "Llama", min: 3, outer: "#F97316", inner: "#FED7AA" },
  { id: "fuego", name: "Fuego", min: 10, outer: "#EF4444", inner: "#FDBA74" },
  { id: "azul", name: "Fuego azul", min: 30, outer: "#38BDF8", inner: "#CFFAFE" },
  { id: "fenix", name: "Fenix", min: 100, outer: "#A78BFA", inner: "#FFFFFF" },
];

export const PERFECT_STAGE = FLAME_STAGES[3];

export function flameStage(days: number): FlameStage | null {
  for (let i = FLAME_STAGES.length - 1; i >= 0; i--) {
    if (days >= FLAME_STAGES[i].min) return FLAME_STAGES[i];
  }
  return null;
}

// Lengua central, una a cada lado y base redonda: se lee como llama y no como gota.
const OUTER =
  "M12 1.5C12.8 4.4 11 6.2 9.6 8C8.4 9.5 7.6 10.6 7.4 12C6.6 11.2 6.3 10.1 6.4 9C4.9 10.7 4 12.8 4 15.2A8 8 0 0 0 20 15.2C20 12.2 18.6 9.9 16.6 8.1C16.6 9.6 16 10.8 14.9 11.4C15.6 7.6 14.4 4 12 1.5Z";
const INNER =
  "M12 10.5C12.8 12.6 15.5 13.8 15.5 16.6A3.5 3.5 0 0 1 8.5 16.6C8.5 15.2 9.4 14.1 10.3 13.4C10.4 14.3 10.8 14.9 11.4 15.2C11.2 13.4 11.4 11.9 12 10.5Z";

type Props = {
  /** Dias de racha; decide el color. Si se pasa `stage`, manda el stage. */
  days?: number;
  stage?: FlameStage | null;
  size?: number;
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Flame({ days = 0, stage, size = 14, glow = false, className, style }: Props) {
  const s = stage === undefined ? flameStage(days) : stage;
  if (!s) return null;
  return (
    <svg
      className={`hf-flame${glow ? " hf-flame--glow" : ""}${className ? " " + className : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ "--fo": s.outer, "--fi": s.inner, ...style } as CSSProperties}
    >
      <path className="hf-flame__out" d={OUTER} />
      <path className="hf-flame__in" d={INNER} />
    </svg>
  );
}

/** Chip de racha: llama + numero. */
export function StreakChip({ days, suffix }: { days: number; suffix?: string }) {
  const s = flameStage(days);
  if (!s) return null;
  return (
    <span className="hf-streak" style={{ "--fo": s.outer } as CSSProperties} title={`${days} ${suffix ?? "dias"} · ${s.name}`}>
      <Flame stage={s} size={13} />
      <b>{days}</b>
      {suffix ? <span>{suffix}</span> : null}
    </span>
  );
}
