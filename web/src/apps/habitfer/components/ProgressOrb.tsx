type Segment = { id: string; color: string; progress: number };

type Props = {
  segments: Segment[];
  done: number;
  total: number;
  size?: number;
};

const R = 42;
const CIRC = 2 * Math.PI * R;

/** Anillo del dia: un tramo por habito, del color de cada uno, que se llena al marcarlo. */
export function ProgressOrb({ segments, done, total, size = 112 }: Props) {
  const n = Math.max(segments.length, 1);
  const gap = n > 1 ? Math.min(5, 60 / n) : 0;
  const seg = (CIRC - n * gap) / n;
  const perfect = total > 0 && done === total;
  const filled = segments.reduce((s, x) => s + x.progress, 0) / n;
  const glow = perfect
    ? undefined
    : `drop-shadow(0 0 ${Math.round(4 + 12 * filled)}px rgba(255, 122, 26, ${(0.15 + 0.4 * filled).toFixed(2)}))`;

  return (
    <div
      className={`hf-orb${perfect ? " hf-orb--perfect" : ""}`}
      style={{ width: size, height: size, filter: glow }}
      role="img"
      aria-label={`${done} de ${total} habitos hechos hoy`}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <g transform="rotate(-90 50 50)">
          {segments.length === 0 && <circle cx={50} cy={50} r={R} fill="none" stroke="var(--hf-track)" strokeWidth={8} />}
          {segments.map((s, i) => {
            const offset = -i * (seg + gap);
            const len = seg * Math.max(0, Math.min(1, s.progress));
            return (
              <g key={s.id}>
                <circle
                  cx={50}
                  cy={50}
                  r={R}
                  fill="none"
                  stroke="var(--hf-track)"
                  strokeWidth={8}
                  strokeDasharray={`${seg} ${CIRC - seg}`}
                  strokeDashoffset={offset}
                />
                <circle
                  className="hf-orb__fill"
                  cx={50}
                  cy={50}
                  r={R}
                  fill="none"
                  stroke={perfect ? "var(--hf-blue)" : s.color}
                  strokeWidth={8}
                  strokeDasharray={`${len} ${CIRC - len}`}
                  strokeDashoffset={offset}
                />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="hf-orb__center">
        <span className="hf-orb__count">
          {done}/{total}
        </span>
        <span className="hf-orb__label">{perfect ? "día perfecto" : "hechos"}</span>
      </div>
    </div>
  );
}
