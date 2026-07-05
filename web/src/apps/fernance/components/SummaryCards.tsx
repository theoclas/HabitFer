import type { FinanceSummary } from "../../../types/fernance";
import { MoneyDisplay } from "./MoneyDisplay";

type SummaryCardsProps = {
  totals: FinanceSummary["totals"];
};

export function SummaryCards({ totals }: SummaryCardsProps) {
  const items = [
    { key: "income", label: "Ingresos", value: totals.income },
    { key: "paid", label: "Cuotas pagadas", value: totals.paidInstallments },
    { key: "available", label: "Disponible", value: totals.available, className: "fern-summary-card--available" },
    { key: "committed", label: "Comprometido", value: totals.committed, className: "fern-summary-card--committed" },
  ];

  return (
    <div className="fern-summary-grid">
      {items.map((item) => (
        <div key={item.key} className={`fern-summary-card ${item.className ?? ""}`}>
          <div className="fern-summary-card__label">{item.label}</div>
          <div className="fern-summary-card__value">
            <MoneyDisplay amount={item.value} />
          </div>
        </div>
      ))}
    </div>
  );
}
