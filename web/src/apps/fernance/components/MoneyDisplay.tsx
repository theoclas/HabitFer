const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCop(amount: number): string {
  return copFormatter.format(amount);
}

type MoneyDisplayProps = {
  amount: number;
  signed?: boolean;
  className?: string;
};

export function MoneyDisplay({ amount, signed, className }: MoneyDisplayProps) {
  const prefix = signed && amount > 0 ? "+" : "";
  const tone =
    signed && amount < 0
      ? "fern-money-negative"
      : signed && amount > 0
        ? "fern-money-positive"
        : "";
  return (
    <span className={[tone, className].filter(Boolean).join(" ")}>
      {prefix}
      {formatCop(amount)}
    </span>
  );
}
