import { useEffect, useRef } from "react";
import type { Figure } from "../types";

type Props = {
  figure: Figure;
  /** Texto para lectores de pantalla (el nombre del ejercicio). */
  label: string;
  /** false: quieta en la primera pose (por ejemplo en listas largas). */
  animate?: boolean;
  /** Muestra la pose B quieta (para revisar las figuras). */
  pose?: "a" | "b";
  className?: string;
};

const SPLINE = "0.45 0 0.55 1;0.45 0 0.55 1";

/**
 * La figura de un ejercicio: líneas que van de la pose A a la B y de vuelta (animación SVG, sin JavaScript).
 * Si la persona prefiere menos movimiento, se queda quieta.
 */
export function ExerciseFigure({ figure, label, animate = true, pose = "a", className }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const shape = pose === "b" && figure.b ? figure.b : figure.a;
  const moving = animate && pose === "a" && figure.b !== null;

  useEffect(() => {
    const el = ref.current;
    if (!el || !moving) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) el.pauseAnimations();
  }, [moving]);

  const anim = (attr: string, a: string | number, b: string | number) =>
    moving ? (
      <animate
        attributeName={attr}
        values={`${a};${b};${a}`}
        dur={`${figure.dur}s`}
        repeatCount="indefinite"
        calcMode="spline"
        keyTimes="0;0.5;1"
        keySplines={SPLINE}
      />
    ) : null;

  const b = figure.b;
  return (
    <svg ref={ref} className={`fit-fig${className ? ` ${className}` : ""}`} viewBox="0 0 120 120" role="img" aria-label={label}>
      {figure.props.map((d, i) => (
        <path key={`p${i}`} d={d} className={i === 0 ? "fit-fig__floor" : "fit-fig__prop"} />
      ))}
      {figure.band && (
        <path d={pose === "b" && figure.band.b ? figure.band.b : figure.band.a} className="fit-fig__band">
          {figure.band.b && anim("d", figure.band.a, figure.band.b)}
        </path>
      )}
      {shape.lines.map((l, i) => (
        <path key={`l${i}`} d={l.d} className={l.far ? "fit-fig__limb fit-fig__limb--far" : "fit-fig__limb"}>
          {b && anim("d", figure.a.lines[i].d, b.lines[i]?.d ?? figure.a.lines[i].d)}
        </path>
      ))}
      <circle cx={shape.head[0]} cy={shape.head[1]} r={7.5} className="fit-fig__head">
        {b && anim("cx", figure.a.head[0], b.head[0])}
        {b && anim("cy", figure.a.head[1], b.head[1])}
      </circle>
      {figure.weights &&
        shape.hands.map((h, i) => (
          <circle key={`w${i}`} cx={h[0]} cy={h[1]} r={4.6} className={figure.view === "side" && i > 0 ? "fit-fig__weight fit-fig__weight--far" : "fit-fig__weight"}>
            {b && b.hands[i] && anim("cx", figure.a.hands[i][0], b.hands[i][0])}
            {b && b.hands[i] && anim("cy", figure.a.hands[i][1], b.hands[i][1])}
          </circle>
        ))}
    </svg>
  );
}
