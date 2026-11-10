import { PlusOutlined } from "@ant-design/icons";
import { Button, Segmented, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { todayKey } from "../../../utils/dates";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchCredits } from "../api";
import { AccountSelector } from "../components/AccountSelector";
import { CreditStatusChip, EmptyState, longDate } from "../components/bits";
import { CreditFormModal } from "../components/CreditFormModal";
import { Money } from "../components/Money";
import { useFinanceContext } from "../context/FinanceContext";
import { dueLabel, formatCop } from "../money";
import type { Credit } from "../types";

const BASE = "/app/fernance";
type Tab = "active" | "done";

function CreditCard({ credit, today, onOpen }: { credit: Credit; today: string; onOpen: () => void }) {
  const count = credit.installments.length;
  const pct = count ? Math.round((credit.paidCount / count) * 100) : 0;
  const next = credit.nextDue;
  const late = Boolean(next && next.dueDate < today);
  return (
    <button type="button" className="ff-credit" onClick={onOpen} aria-label={`${credit.name}. Abrir el detalle`}>
      <span className="ff-credit__top">
        <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span className="ff-credit__name">{credit.name}</span>
          <span className="ff-row__meta">
            <span className="ff-dot" style={{ background: credit.account.color ?? undefined }} />
            {credit.account.name}
          </span>
        </span>
        <CreditStatusChip status={credit.status} />
      </span>
      <span className="ff-progress" role="img" aria-label={`${credit.paidCount} de ${count} cuotas pagadas`}>
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="ff-credit__nums">
        <span>
          {credit.paidCount} de {count} cuotas · pagado <b>{formatCop(credit.paidTotal)}</b>
        </span>
        <span>
          Falta <b>{formatCop(credit.pendingTotal)}</b>
        </span>
      </span>
      {credit.status === "ACTIVE" && next && (
        <p className={`ff-credit__next${late ? " is-late" : ""}`}>
          {late
            ? `${credit.overdueCount > 1 ? `${credit.overdueCount} cuotas vencidas` : "Cuota vencida"}: ${formatCop(credit.overdueTotal)} · ${dueLabel(next.dueDate, today)}`
            : `Próxima: ${longDate(next.dueDate, today)} · ${formatCop(next.amount)} · ${dueLabel(next.dueDate, today)}`}
        </p>
      )}
      {credit.status === "PAID_OFF" && <p className="ff-credit__next">Pagado del todo. ¡Bien!</p>}
      {credit.status === "CANCELLED" && <p className="ff-credit__next">Cancelado: sus cuotas pendientes ya no cuentan.</p>}
    </button>
  );
}

export function CreditsPage() {
  const navigate = useNavigate();
  const { accountId, accounts } = useFinanceContext();
  const [credits, setCredits] = useState<Credit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [createOpen, setCreateOpen] = useState(false);
  const today = todayKey();

  const load = useCallback(async () => {
    try {
      setError(null);
      setCredits(await fetchCredits({ accountId: accountId ?? undefined }));
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudieron cargar los créditos."));
    }
  }, [accountId]);

  useEffect(() => {
    setCredits(null);
    void load();
  }, [load]);

  const active = (credits ?? []).filter((c) => c.status === "ACTIVE");
  const done = (credits ?? []).filter((c) => c.status !== "ACTIVE");
  const shown = tab === "active" ? active : done;
  const owed = active.reduce((s, c) => s + c.pendingTotal, 0);

  return (
    <div className="ff-page">
      <div className="ff-pagehead">
        <div>
          <h1 className="ff-title">Créditos</h1>
          <p className="ff-subtitle">
            {credits ? (
              active.length ? (
                <>
                  Debes <Money value={owed} tone="out" /> en {active.length === 1 ? "1 crédito activo" : `${active.length} créditos activos`}.
                </>
              ) : (
                "No tienes créditos activos."
              )
            ) : (
              "Tus préstamos, compras a cuotas y tarjetas."
            )}
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} disabled={!accounts.length}>
          Nuevo crédito
        </Button>
      </div>
      <div className="ff-toolbar">
        <AccountSelector />
        <Segmented
          aria-label="Qué créditos ver"
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: "active", label: `Activos${credits ? ` (${active.length})` : ""}` },
            { value: "done", label: `Terminados${credits ? ` (${done.length})` : ""}` },
          ]}
        />
      </div>

      {error && (
        <EmptyState title="No se pudieron cargar los créditos" action={<Button onClick={() => void load()}>Reintentar</Button>}>
          {error}
        </EmptyState>
      )}
      {!credits && !error && <Skeleton active paragraph={{ rows: 5 }} />}

      {credits && shown.length === 0 && (
        <EmptyState
          title={tab === "active" ? "Sin créditos activos" : "Todavía no terminas ninguno"}
          action={
            tab === "active" ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} disabled={!accounts.length}>
                Agregar un crédito
              </Button>
            ) : undefined
          }
        >
          {tab === "active"
            ? "Agrega un préstamo, una compra a cuotas o la tarjeta, y FerFinance te muestra cada cuota y cuándo vence."
            : "Aquí quedan los créditos pagados del todo y los cancelados, con su historia."}
        </EmptyState>
      )}

      {credits && shown.length > 0 && (
        <div className="ff-credit-grid">
          {shown.map((c) => (
            <CreditCard key={c.id} credit={c} today={today} onOpen={() => navigate(`${BASE}/credits/${c.id}`)} />
          ))}
        </div>
      )}

      <CreditFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={(c) => {
          void load();
          navigate(`${BASE}/credits/${c.id}`);
        }}
      />
    </div>
  );
}
