import { PlusOutlined } from "@ant-design/icons";
import { Button, Skeleton } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchFinanceSummary } from "../api";
import { AccountSelector } from "../components/AccountSelector";
import { Billete } from "../components/Billete";
import { DateBlock, EmptyState } from "../components/bits";
import { IncomeFormModal } from "../components/IncomeFormModal";
import { Money } from "../components/Money";
import { PayInstallmentModal, type PayTarget } from "../components/PayInstallmentModal";
import { PeriodPicker } from "../components/PeriodPicker";
import { monthLabel, rangeLabel, useFinanceContext } from "../context/FinanceContext";
import { dueLabel, formatCop } from "../money";
import type { DueItem, FinanceMovement, FinanceSummary } from "../types";

const TYPE_CHIP: Record<FinanceMovement["type"], { text: string; tone: string }> = {
  income: { text: "Ingreso", tone: "ff-chip--ok" },
  installment_paid: { text: "Cuota pagada", tone: "" },
  installment_pending: { text: "Por pagar", tone: "ff-chip--gold" },
  installment_overdue: { text: "Vencida", tone: "ff-chip--late" },
};
const FIRST_ROWS = 12;

function payTargetOf(item: DueItem): PayTarget {
  return { id: item.id, creditName: item.creditName, dueDate: item.dueDate, amount: item.amount, accountId: item.accountId };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { accountId, bounds, periodMode, year, month, accounts, accountsLoaded } = useFinanceContext();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setSummary(await fetchFinanceSummary({ accountId: accountId ?? undefined, from: bounds.from, to: bounds.to }));
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudo cargar el resumen."));
    }
  }, [accountId, bounds.from, bounds.to]);

  useEffect(() => {
    setSummary(null);
    setShowAll(false);
    void load();
  }, [load]);

  const periodName = periodMode === "month" ? monthLabel(year, month) : rangeLabel(bounds.from, bounds.to);
  const movements = useMemo(() => [...(summary?.movements ?? [])].reverse(), [summary]);
  const visible = showAll ? movements : movements.slice(0, FIRST_ROWS);
  const maxProjection = Math.max(1, ...(summary?.projection ?? []).map((p) => p.total));

  if (accountsLoaded && accounts.length === 0) {
    return (
      <div className="ff-page">
        <div className="ff-pagehead">
          <div>
            <h1 className="ff-title">Resumen</h1>
          </div>
        </div>
        <EmptyState
          title="Empieza por tus cuentas"
          action={
            <Button type="primary" onClick={() => navigate("/app/fernance/accounts")}>
              Crear mi primera cuenta
            </Button>
          }
        >
          Una cuenta agrupa tus ingresos y créditos: por ejemplo «Personal» y «Negocio». Después anotas lo que entra y tus cuotas.
        </EmptyState>
      </div>
    );
  }

  const onMovementClick = (m: FinanceMovement) => {
    if (m.type === "installment_pending" || m.type === "installment_overdue") {
      setPayTarget({ id: m.id, creditName: m.creditName ?? m.label, dueDate: m.date, amount: -m.amount, accountId: m.accountId });
    } else if (m.creditId) navigate(`/app/fernance/credits/${m.creditId}`);
    else navigate("/app/fernance/incomes");
  };

  return (
    <div className="ff-page">
      <div className="ff-pagehead">
        <div>
          <h1 className="ff-title">Resumen</h1>
          <p className="ff-subtitle">Lo que entró, lo que pagaste y lo que viene.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIncomeOpen(true)} disabled={!accounts.length}>
          Anotar ingreso
        </Button>
      </div>
      <div className="ff-toolbar">
        <AccountSelector />
        <PeriodPicker />
      </div>

      {error && (
        <EmptyState title="No se pudo cargar el resumen" action={<Button onClick={() => void load()}>Reintentar</Button>}>
          {error}
        </EmptyState>
      )}

      {!summary && !error && <Skeleton active paragraph={{ rows: 6 }} />}

      {summary && (
        <div className="ff-dash">
          <div className="ff-dash__main">
            <Billete label={`Disponible · ${periodName}`} amount={formatCop(summary.totals.available)} negative={summary.totals.available < 0}>
              <p className="ff-billete__sub">
                Entró <b>{formatCop(summary.totals.income)}</b> y pagaste <b>{formatCop(summary.totals.paidInstallments)}</b> en cuotas.
                {summary.totals.committed > 0 && (
                  <>
                    {" "}
                    Faltan <b>{formatCop(summary.totals.committed)}</b> por pagar en este periodo.
                  </>
                )}
              </p>
            </Billete>

            <div className="ff-tiles">
              <div className="ff-tile ff-tile--in">
                <span className="ff-tile__label">Ingresos</span>
                <span className="ff-tile__value">{formatCop(summary.totals.income)}</span>
              </div>
              <div className="ff-tile">
                <span className="ff-tile__label">Cuotas pagadas</span>
                <span className="ff-tile__value">{formatCop(summary.totals.paidInstallments)}</span>
              </div>
              <div className="ff-tile">
                <span className="ff-tile__label">Por pagar</span>
                <span className="ff-tile__value">{formatCop(summary.totals.committed)}</span>
              </div>
              <div className={`ff-tile${summary.totals.overdue > 0 ? " ff-tile--late" : ""}`}>
                <span className="ff-tile__label">Vencidas</span>
                <span className="ff-tile__value">{formatCop(summary.totals.overdue)}</span>
              </div>
            </div>

            <section className="ff-card" aria-labelledby="ff-mov-title">
              <div className="ff-card__head">
                <h2 id="ff-mov-title" className="ff-section-title">
                  Movimientos del periodo
                </h2>
                <span className="ff-hint">{movements.length === 1 ? "1 movimiento" : `${movements.length} movimientos`}</span>
              </div>
              {movements.length === 0 ? (
                <p className="ff-hint">Nada en este periodo. Anota un ingreso o cambia de mes.</p>
              ) : (
                <div className="ff-list">
                  {visible.map((m) => (
                    <button key={`${m.type}-${m.id}`} type="button" className="ff-row" onClick={() => onMovementClick(m)}>
                      <DateBlock dateKey={m.date} />
                      <span className="ff-row__main">
                        <span className="ff-row__title">{m.label}</span>
                        <span className="ff-row__meta">
                          <span className={`ff-chip ${TYPE_CHIP[m.type].tone}`}>
                            {m.type === "installment_overdue" && m.daysLate ? `Vencida hace ${m.daysLate} d` : TYPE_CHIP[m.type].text}
                          </span>
                          {m.accountName}
                        </span>
                      </span>
                      <span className="ff-row__end">
                        <Money value={m.amount} signed tone={m.type === "income" ? "in" : m.type === "installment_paid" ? "out" : "muted"} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {movements.length > FIRST_ROWS && (
                <Button type="link" className="ff-more" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Ver menos" : `Ver los ${movements.length}`}
                </Button>
              )}
            </section>
          </div>

          <aside className="ff-dash__side" aria-label="Cuotas">
            {summary.overdue.length > 0 && (
              <section className="ff-card ff-card--late" aria-labelledby="ff-late-title">
                <div className="ff-card__head">
                  <h2 id="ff-late-title" className="ff-section-title">
                    Vencidas
                  </h2>
                  <Money value={summary.totals.overdue} tone="out" />
                </div>
                <div className="ff-list">
                  {summary.overdue.map((item) => (
                    <div key={item.id} className="ff-row">
                      <DateBlock dateKey={item.dueDate} />
                      <span className="ff-row__main">
                        <span className="ff-row__title">{item.creditName}</span>
                        <span className="ff-row__meta">
                          <span className="ff-chip ff-chip--late">{dueLabel(item.dueDate, summary.today)}</span>
                          <Money value={item.amount} />
                        </span>
                      </span>
                      <Button size="small" type="primary" onClick={() => setPayTarget(payTargetOf(item))}>
                        Pagar
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="ff-card" aria-labelledby="ff-next-title">
              <div className="ff-card__head">
                <h2 id="ff-next-title" className="ff-section-title">
                  Próximas cuotas
                </h2>
                <Button type="link" size="small" onClick={() => navigate("/app/fernance/credits")}>
                  Ver créditos
                </Button>
              </div>
              {summary.upcoming.length === 0 ? (
                <p className="ff-hint">No tienes cuotas pendientes.</p>
              ) : (
                <div className="ff-list">
                  {summary.upcoming.map((item) => (
                    <div key={item.id} className="ff-row">
                      <DateBlock dateKey={item.dueDate} />
                      <span className="ff-row__main">
                        <span className="ff-row__title">{item.creditName}</span>
                        <span className="ff-row__meta">
                          {dueLabel(item.dueDate, summary.today)} · <Money value={item.amount} />
                        </span>
                      </span>
                      <Button size="small" onClick={() => setPayTarget(payTargetOf(item))}>
                        Pagar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {summary.projection.length > 0 && (
              <section className="ff-card" aria-labelledby="ff-proj-title">
                <h2 id="ff-proj-title" className="ff-section-title">
                  Lo que viene en cuotas
                </h2>
                <div className="ff-proj">
                  {summary.projection.slice(0, 6).map((p) => {
                    const [y, m] = p.month.split("-").map(Number);
                    return (
                      <div key={p.month} className="ff-proj__row" title={p.installments.map((i) => `${i.creditName}: ${formatCop(i.amount)}`).join("\n")}>
                        <span className="ff-proj__month">{new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "short", year: "2-digit" })}</span>
                        <span className="ff-proj__bar" aria-hidden="true">
                          <i style={{ width: `${Math.max(4, (p.total / maxProjection) * 100)}%` }} />
                        </span>
                        <Money value={p.total} />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}

      <PayInstallmentModal target={payTarget} onClose={() => setPayTarget(null)} onDone={() => void load()} />
      <IncomeFormModal open={incomeOpen} onClose={() => setIncomeOpen(false)} onDone={() => void load()} />
    </div>
  );
}
