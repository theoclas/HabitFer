import type { ReactNode } from "react";
import { CREDIT_STATUS_LABELS, type CreditStatus } from "../types";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «9 nov» en dos líneas, para el comienzo de una fila. */
export function DateBlock({ dateKey }: { dateKey: string }) {
  const [, m, d] = dateKey.split("-").map(Number);
  return (
    <span className="ff-row__date" aria-hidden="true">
      <span className="ff-row__day">{d}</span>
      <span className="ff-row__mon">{MONTHS[m - 1]}</span>
    </span>
  );
}

/** «9 de noviembre de 2026» (o sin el año si es el de hoy). */
export function longDate(dateKey: string, todayKey?: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const sameYear = todayKey ? todayKey.slice(0, 4) === String(y) : false;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-CO", sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
}

export function CreditStatusChip({ status }: { status: CreditStatus }) {
  const tone = status === "ACTIVE" ? "ff-chip--gold" : status === "PAID_OFF" ? "ff-chip--ok" : "";
  return <span className={`ff-chip ${tone}`}>{CREDIT_STATUS_LABELS[status]}</span>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ff-empty">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}
