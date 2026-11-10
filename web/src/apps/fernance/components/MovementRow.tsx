import { Checkbox } from "antd";
import { formatCop } from "../money";
import type { MovementItem } from "../types";
import { Money } from "./Money";

const TYPE_ICON: Record<MovementItem["type"], string> = {
  INCOME: "💰",
  EXPENSE: "🧾",
  TRANSFER: "🔁",
  ADJUSTMENT: "⚖️",
  INSTALLMENT: "💳",
};

type Props = {
  m: MovementItem;
  onOpen: () => void;
  /** Modo de escoger varios. */
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
};

/** Una fila de la lista de movimientos: ícono, qué fue, de qué cuenta y cuánto (verde entra, cobre sale). */
export function MovementRow({ m, onOpen, selectable = false, selected = false, onToggle }: Props) {
  const icon = m.categoryIcon ?? TYPE_ICON[m.type];
  const where =
    m.type === "TRANSFER" ? `${m.accountName} → ${m.toAccountName ?? "Cuenta"}` : m.accountName;
  const category = m.categoryName && m.categoryName !== m.title ? m.categoryName : null;
  const amountLabel =
    m.effect === 0 ? `${formatCop(m.amount)}, entre tus cuentas` : `${m.effect > 0 ? "entró" : "salió"} ${formatCop(Math.abs(m.effect))}`;

  return (
    <div className={`ff-mrow${selected ? " is-selected" : ""}`}>
      {selectable && (
        <Checkbox checked={selected} onChange={onToggle} aria-label={`Escoger «${m.title}»`} disabled={m.kind !== "tx"} />
      )}
      <button
        type="button"
        className="ff-mrow__btn"
        onClick={selectable && m.kind === "tx" ? onToggle : onOpen}
        aria-label={`${m.title}, ${amountLabel}. ${selectable ? "Toca para escoger" : "Toca para ver o editar"}`}
      >
        <span className="ff-mrow__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="ff-row__main">
          <span className="ff-row__title">{m.title}</span>
          <span className="ff-row__meta">
            {category && <span>{category}</span>}
            {category && <span aria-hidden="true">·</span>}
            <span className="ff-dot" style={{ background: m.accountColor ?? undefined }} />
            <span>{where}</span>
            {m.type === "ADJUSTMENT" && <span className="ff-chip">Cuadre</span>}
            {m.source === "TEXT" && (
              <span className="ff-chip" title="Lo escribiste como hablas">
                Escrito
              </span>
            )}
          </span>
        </span>
        <span className="ff-row__end">
          {m.effect === 0 ? (
            <span className="ff-amount ff-amount--muted">↔ {formatCop(m.amount)}</span>
          ) : (
            <Money value={m.effect} signed tone={m.effect > 0 ? "in" : "out"} />
          )}
        </span>
      </button>
    </div>
  );
}
