import { PlusOutlined } from "@ant-design/icons";
import { Button, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchFinanceSummary } from "../api";
import { Billete } from "../components/Billete";
import { DateBlock, EmptyState } from "../components/bits";
import { Money } from "../components/Money";
import { MovementRow } from "../components/MovementRow";
import { PayInstallmentModal, type PayTarget } from "../components/PayInstallmentModal";
import { PeriodPicker } from "../components/PeriodPicker";
import { ScopeSelector } from "../components/ScopeSelector";
import { monthLabel, rangeLabel, useFinanceContext } from "../context/FinanceContext";
import { dueLabel, formatCop } from "../money";
import { ACCOUNT_KIND_ICONS, ACCOUNT_TYPE_LABELS, type DueItem, type FinanceSummary, type MovementItem } from "../types";

const BASE = "/app/fernance";

function payTargetOf(item: DueItem): PayTarget {
  return { id: item.id, creditName: item.creditName, dueDate: item.dueDate, amount: item.amount, accountId: item.accountId };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { scopeParams, accountId, book, setScope, bounds, periodMode, year, month, accounts, accountsLoaded, openQuickAdd, dataVersion, bumpData } =
    useFinanceContext();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setSummary(await fetchFinanceSummary({ ...scopeParams, from: bounds.from, to: bounds.to }));
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudo cargar el resumen."));
    }
  }, [scopeParams, bounds.from, bounds.to]);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  useEffect(() => {
    setSummary(null);
  }, [scopeParams, bounds.from, bounds.to]);

  const periodName = periodMode === "month" ? monthLabel(year, month) : rangeLabel(bounds.from, bounds.to);
  const scopeName = accountId
    ? (accounts.find((a) => a.id === accountId)?.name ?? "La cuenta")
    : book
      ? `Libro ${ACCOUNT_TYPE_LABELS[book]}`
      : "En tus cuentas";
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
            <Button type="primary" onClick={() => navigate(`${BASE}/accounts`)}>
              Crear mi primera cuenta
            </Button>
          }
        >
          Tu cuenta de ahorros, Nequi, el efectivo y tus tarjetas, cada una con su saldo. Después anotas lo que entra y lo que
          sale, y aquí ves toda tu plata en un lugar.
        </EmptyState>
      </div>
    );
  }

  const openMovement = (m: MovementItem) => {
    if (m.kind === "installment") {
      if (m.creditId) navigate(`${BASE}/credits/${m.creditId}`);
    } else openQuickAdd({ edit: m });
  };

  const totals = summary?.totals;
  const out = totals ? totals.expense + totals.paidInstallments : 0;

  return (
    <div className="ff-page">
      <div className="ff-pagehead">
        <div>
          <h1 className="ff-title">Resumen</h1>
          <p className="ff-subtitle">Tu plata de hoy y lo que pasó en {periodName}.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openQuickAdd()}>
          Anotar
        </Button>
      </div>
      <div className="ff-toolbar">
        <ScopeSelector />
        <PeriodPicker />
      </div>

      {error && (
        <EmptyState title="No se pudo cargar el resumen" action={<Button onClick={() => void load()}>Reintentar</Button>}>
          {error}
        </EmptyState>
      )}

      {!summary && !error && <Skeleton active paragraph={{ rows: 6 }} />}

      {summary && totals && (
        <div className="ff-dash">
          <div className="ff-dash__main">
            <Billete label={`${scopeName} · hoy`} amount={formatCop(summary.balances.total)} negative={summary.balances.total < 0}>
              <p className="ff-billete__sub">
                En {periodName} entró <b>{formatCop(totals.income)}</b> y salió <b>{formatCop(out)}</b>
                {totals.paidInstallments > 0 && (
                  <>
                    {" "}
                    ({formatCop(totals.expense)} en gastos y {formatCop(totals.paidInstallments)} en cuotas)
                  </>
                )}
                .
                {totals.transfersOut > 0 && <> Pasaste {formatCop(totals.transfersOut)} a otro libro.</>}
                {totals.committed > 0 && (
                  <>
                    {" "}
                    Faltan <b>{formatCop(totals.committed)}</b> en cuotas por pagar.
                  </>
                )}
              </p>
            </Billete>

            {!accountId && summary.balances.accounts.length > 0 && (
              <div className="ff-accstrip" role="list" aria-label="Saldo de cada cuenta">
                {summary.balances.accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="listitem"
                    className="ff-accmini"
                    style={{ ["--ff-account" as string]: a.color ?? undefined }}
                    onClick={() => {
                      setScope({ accountId: a.id });
                      navigate(`${BASE}/movements`);
                    }}
                    aria-label={`${a.name}: ${a.kind === "CREDIT_CARD" && a.balance < 0 ? `debes ${formatCop(-a.balance)}` : formatCop(a.balance)}. Ver sus movimientos`}
                  >
                    <span className="ff-accmini__name">
                      <span aria-hidden="true">{ACCOUNT_KIND_ICONS[a.kind]}</span> {a.name}
                    </span>
                    {a.kind === "CREDIT_CARD" && a.balance < 0 ? (
                      <span className="ff-accmini__value is-debt">Debes {formatCop(-a.balance)}</span>
                    ) : (
                      <span className={`ff-accmini__value${a.balance < 0 ? " is-debt" : ""}`}>{formatCop(a.balance)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="ff-tiles">
              <div className="ff-tile ff-tile--in">
                <span className="ff-tile__label">Ingresos</span>
                <span className="ff-tile__value">{formatCop(totals.income)}</span>
              </div>
              <div className="ff-tile ff-tile--out">
                <span className="ff-tile__label">Gastos</span>
                <span className="ff-tile__value">{formatCop(totals.expense)}</span>
              </div>
              <div className="ff-tile">
                <span className="ff-tile__label">Cuotas pagadas</span>
                <span className="ff-tile__value">{formatCop(totals.paidInstallments)}</span>
              </div>
              <div className={`ff-tile${totals.overdue > 0 ? " ff-tile--late" : ""}`}>
                <span className="ff-tile__label">{totals.overdue > 0 ? "Vencidas" : "Por pagar"}</span>
                <span className="ff-tile__value">{formatCop(totals.overdue > 0 ? totals.overdue : totals.committed)}</span>
              </div>
            </div>

            <section className="ff-card" aria-labelledby="ff-mov-title">
              <div className="ff-card__head">
                <h2 id="ff-mov-title" className="ff-section-title">
                  Lo último
                </h2>
                {summary.movementCount > 0 && (
                  <Button type="link" size="small" onClick={() => navigate(`${BASE}/movements`)}>
                    Ver los {summary.movementCount} de {periodMode === "month" ? "este mes" : "este periodo"}
                  </Button>
                )}
              </div>
              {summary.recent.length === 0 ? (
                <div className="ff-empty ff-empty--flat">
                  <p>Nada anotado en este periodo.</p>
                  <Button icon={<PlusOutlined />} onClick={() => openQuickAdd()}>
                    Anotar un gasto o un ingreso
                  </Button>
                </div>
              ) : (
                <div className="ff-list">
                  {summary.recent.map((m) => (
                    <MovementRow key={`${m.kind}-${m.id}`} m={m} onOpen={() => openMovement(m)} />
                  ))}
                </div>
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
                  <Money value={totals.overdue} tone="out" />
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
                <Button type="link" size="small" onClick={() => navigate(`${BASE}/credits`)}>
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

      <PayInstallmentModal target={payTarget} onClose={() => setPayTarget(null)} onDone={bumpData} />
    </div>
  );
}
