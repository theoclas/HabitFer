import { PlusOutlined } from "@ant-design/icons";
import { Button, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchIncomes } from "../api";
import { AccountSelector } from "../components/AccountSelector";
import { DateBlock, EmptyState } from "../components/bits";
import { IncomeFormModal } from "../components/IncomeFormModal";
import { Money } from "../components/Money";
import { PeriodPicker } from "../components/PeriodPicker";
import { monthLabel, rangeLabel, useFinanceContext } from "../context/FinanceContext";
import { formatCop } from "../money";
import type { Income } from "../types";

export function IncomesPage() {
  const { accountId, bounds, periodMode, year, month, accounts } = useFinanceContext();
  const [incomes, setIncomes] = useState<Income[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Income | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setIncomes(await fetchIncomes({ accountId: accountId ?? undefined, from: bounds.from, to: bounds.to }));
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudieron cargar los ingresos."));
    }
  }, [accountId, bounds.from, bounds.to]);

  useEffect(() => {
    setIncomes(null);
    void load();
  }, [load]);

  const total = (incomes ?? []).reduce((s, i) => s + i.amount, 0);
  const periodName = periodMode === "month" ? monthLabel(year, month) : rangeLabel(bounds.from, bounds.to);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <div className="ff-page">
      <div className="ff-pagehead">
        <div>
          <h1 className="ff-title">Ingresos</h1>
          <p className="ff-subtitle">
            {incomes ? (
              <>
                Entró <Money value={total} tone="in" /> en {periodName}.
              </>
            ) : (
              "Lo que te entra, por cuenta."
            )}
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew} disabled={!accounts.length}>
          Anotar ingreso
        </Button>
      </div>
      <div className="ff-toolbar">
        <AccountSelector />
        <PeriodPicker />
      </div>

      {error && (
        <EmptyState title="No se pudieron cargar los ingresos" action={<Button onClick={() => void load()}>Reintentar</Button>}>
          {error}
        </EmptyState>
      )}
      {!incomes && !error && <Skeleton active paragraph={{ rows: 5 }} />}

      {incomes && incomes.length === 0 && (
        <EmptyState
          title="Sin ingresos en este periodo"
          action={
            <Button type="primary" icon={<PlusOutlined />} onClick={openNew} disabled={!accounts.length}>
              Anotar el primero
            </Button>
          }
        >
          {accounts.length ? "Anota tu salario, una venta o la prima, y aparece aquí y en el resumen." : "Primero crea una cuenta en la pestaña Cuentas."}
        </EmptyState>
      )}

      {incomes && incomes.length > 0 && (
        <section className="ff-card" aria-label={`Ingresos de ${periodName}`}>
          <div className="ff-list">
            {incomes.map((i) => (
              <button
                key={i.id}
                type="button"
                className="ff-row"
                onClick={() => {
                  setEditing(i);
                  setOpen(true);
                }}
                aria-label={`${i.description || "Ingreso"}, ${formatCop(i.amount)}. Toca para editar`}
              >
                <DateBlock dateKey={i.date} />
                <span className="ff-row__main">
                  <span className="ff-row__title">{i.description || "Ingreso"}</span>
                  <span className="ff-row__meta">
                    <span className="ff-dot" style={{ background: i.account?.color ?? undefined }} />
                    {i.account?.name ?? "Cuenta"}
                  </span>
                </span>
                <span className="ff-row__end">
                  <Money value={i.amount} signed tone="in" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <IncomeFormModal open={open} income={editing} onClose={() => setOpen(false)} onDone={() => void load()} />
    </div>
  );
}
