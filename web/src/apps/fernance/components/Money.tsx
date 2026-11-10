import { formatCop, formatCopSigned } from "../money";

type Props = {
  value: number;
  /** Con signo: «+$ 850.000» o «−$ 300.000». */
  signed?: boolean;
  /** in = esmeralda (entra), out = cobre (sale), auto = según el signo. */
  tone?: "in" | "out" | "muted" | "auto";
  className?: string;
};

/** Un valor en pesos, con cifras alineadas. */
export function Money({ value, signed = false, tone, className }: Props) {
  const resolved = tone === "auto" ? (value > 0 ? "in" : value < 0 ? "out" : undefined) : tone;
  const classes = ["ff-amount", resolved ? `ff-amount--${resolved}` : "", className ?? ""].filter(Boolean).join(" ");
  return <span className={classes}>{signed ? formatCopSigned(value) : formatCop(value)}</span>;
}
