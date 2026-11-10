import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined, EditOutlined, RedoOutlined, StopOutlined, UndoOutlined } from "@ant-design/icons";
import { App, Button, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { todayKey } from "../../../utils/dates";
import { apiErrorMessage } from "../../habitfer/format";
import { deleteCredit, deleteInstallment, fetchCredit, unpayInstallment, updateCredit } from "../api";
import { CreditStatusChip, EmptyState, longDate } from "../components/bits";
import { CreditFormModal } from "../components/CreditFormModal";
import { InstallmentEditModal } from "../components/InstallmentEditModal";
import { Money } from "../components/Money";
import { PayInstallmentModal, type PayTarget } from "../components/PayInstallmentModal";
import { ReplanModal } from "../components/ReplanModal";
import { useFinanceContext } from "../context/FinanceContext";
import { dueLabel, formatCop } from "../money";
import type { Credit, CreditInstallment } from "../types";

const BASE = "/app/fernance";

export function CreditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { accounts } = useFinanceContext();
  const [credit, setCredit] = useState<Credit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [editInst, setEditInst] = useState<CreditInstallment | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [replanOpen, setReplanOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const today = todayKey();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setCredit(await fetchCredit(id));
    } catch (err) {
      setError(apiErrorMessage(err, "No encontré ese crédito."));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const accountName = (accId: string | null) => (accId ? accounts.find((a) => a.id === accId)?.name ?? "otra cuenta" : credit?.account.name ?? "");

  const run = async (key: string, action: () => Promise<Credit | void>, ok: string) => {
    setBusy(key);
    try {
      const updated = await action();
      if (updated) setCredit(updated);
      message.success(ok);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo hacer el cambio"));
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="ff-page">
        <Link to={`${BASE}/credits`}>
          <Button icon={<ArrowLeftOutlined />}>Créditos</Button>
        </Link>
        <EmptyState title="No se pudo abrir el crédito">{error}</EmptyState>
      </div>
    );
  }
  if (!credit) return <Skeleton active paragraph={{ rows: 8 }} />;

  const count = credit.installments.length;
  const pct = count ? Math.round((credit.paidCount / count) * 100) : 0;
  const cancelled = credit.status === "CANCELLED";

  const toggleCancel = () => {
    if (cancelled) {
      void run("status", () => updateCredit(credit.id, { status: "ACTIVE" }), "Crédito reactivado");
      return;
    }
    modal.confirm({
      title: "¿Cancelar este crédito?",
      content: "Sus cuotas pendientes dejan de contar como deuda y dejan de salir en el resumen. Las pagadas se quedan en la historia. Lo puedes reactivar.",
      okText: "Cancelar crédito",
      cancelText: "Volver",
      onOk: () => run("status", () => updateCredit(credit.id, { status: "CANCELLED" }), "Crédito cancelado"),
    });
  };

  const remove = () => {
    modal.confirm({
      title: `¿Borrar «${credit.name}» para siempre?`,
      content: `Se borran sus ${count} cuotas, también las pagadas, y salen de tus resúmenes. No se puede deshacer. Si ya no aplica pero quieres conservar la historia, mejor cancélalo.`,
      okText: "Borrar para siempre",
      okType: "danger",
      cancelText: "Volver",
      onOk: async () => {
        try {
          await deleteCredit(credit.id);
          message.success("Crédito borrado");
          navigate(`${BASE}/credits`);
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo borrar"));
        }
      },
    });
  };

  const removeInstallment = (inst: CreditInstallment, k: number) => {
    modal.confirm({
      title: `¿Borrar la cuota ${k} de ${count}?`,
      content: `Vence el ${longDate(inst.dueDate)} por ${formatCop(inst.amount)}. El total del crédito baja en ese valor.`,
      okText: "Borrar cuota",
      okType: "danger",
      cancelText: "Volver",
      onOk: () => run(`del-${inst.id}`, () => deleteInstallment(inst.id), "Cuota borrada"),
    });
  };

  const payTargetOf = (inst: CreditInstallment): PayTarget => ({
    id: inst.id,
    creditName: credit.name,
    dueDate: inst.dueDate,
    amount: inst.amount,
    accountId: credit.accountId,
    paidDate: inst.paidDate,
    paidAmount: inst.paidAmount,
    paidAccountId: inst.paidAccountId,
  });

  return (
    <div className="ff-page" style={{ maxWidth: 920 }}>
      <Link to={`${BASE}/credits`} style={{ justifySelf: "start" }}>
        <Button icon={<ArrowLeftOutlined />}>Créditos</Button>
      </Link>

      <section className="ff-card" aria-labelledby="ff-credit-title">
        <div className="ff-card__head">
          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <h1 id="ff-credit-title" className="ff-title" style={{ fontSize: "1.6rem" }}>
              {credit.name}
            </h1>
            <span className="ff-row__meta">
              <span className="ff-dot" style={{ background: credit.account.color ?? undefined }} />
              {credit.account.name}
              {credit.account.archived ? " (archivada)" : ""}
            </span>
          </div>
          <CreditStatusChip status={credit.status} />
        </div>

        <div className="ff-kv">
          <div>
            <span>Total</span>
            <b>{formatCop(credit.totalAmount)}</b>
          </div>
          <div>
            <span>Pagado</span>
            <b>{formatCop(credit.paidTotal)}</b>
          </div>
          <div>
            <span>Falta</span>
            <b>{formatCop(credit.pendingTotal)}</b>
          </div>
          <div>
            <span>{credit.nextDue && credit.nextDue.dueDate < today ? "Vencida" : "Próxima cuota"}</span>
            <b>{credit.nextDue && !cancelled ? `${longDate(credit.nextDue.dueDate, today)}` : "—"}</b>
          </div>
        </div>
        <span className="ff-progress" role="img" aria-label={`${credit.paidCount} de ${count} cuotas pagadas`}>
          <i style={{ width: `${pct}%` }} />
        </span>
        <p className="ff-hint">
          {credit.paidCount} de {count} cuotas pagadas{credit.overdueCount ? ` · ${credit.overdueCount} vencidas por ${formatCop(credit.overdueTotal)}` : ""}.
        </p>

        <div className="ff-actions">
          <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
            Editar
          </Button>
          <Button icon={<RedoOutlined />} onClick={() => setReplanOpen(true)}>
            Rehacer cuotas
          </Button>
          <Button icon={cancelled ? <UndoOutlined /> : <StopOutlined />} loading={busy === "status"} onClick={toggleCancel}>
            {cancelled ? "Reactivar" : "Cancelar crédito"}
          </Button>
          <Button danger icon={<DeleteOutlined />} onClick={remove}>
            Borrar
          </Button>
        </div>
      </section>

      <section className="ff-card" aria-labelledby="ff-inst-title">
        <h2 id="ff-inst-title" className="ff-section-title">
          Cuotas
        </h2>
        <div>
          {credit.installments.map((inst, idx) => {
            const k = idx + 1;
            const paid = inst.status === "PAID";
            const late = !paid && !cancelled && inst.dueDate < today;
            return (
              <div key={inst.id} className={`ff-inst${paid ? " ff-inst--paid" : late ? " ff-inst--late" : ""}`}>
                <span className="ff-inst__n" aria-hidden="true">
                  {paid ? <CheckOutlined /> : k}
                </span>
                <span className="ff-inst__main">
                  <span className="ff-row__title">
                    Cuota {k} de {count} · <Money value={inst.amount} />
                  </span>
                  <span className="ff-row__meta">
                    {paid ? (
                      <>
                        <span className="ff-chip ff-chip--ok">Pagada</span>
                        el {longDate(inst.paidDate ?? inst.dueDate, today)}
                        {inst.paidAmount !== null && inst.paidAmount !== inst.amount ? <> · pagaste {formatCop(inst.paidAmount)}</> : null}
                        {inst.paidAccountId ? <> · desde {accountName(inst.paidAccountId)}</> : null}
                      </>
                    ) : (
                      <>
                        <span className={`ff-chip ${late ? "ff-chip--late" : cancelled ? "" : "ff-chip--gold"}`}>
                          {cancelled ? "No cuenta" : dueLabel(inst.dueDate, today)}
                        </span>
                        vence el {longDate(inst.dueDate, today)}
                      </>
                    )}
                  </span>
                </span>
                <span className="ff-inst__end">
                  {paid ? (
                    <>
                      <Button size="small" onClick={() => setPayTarget(payTargetOf(inst))}>
                        Cambiar pago
                      </Button>
                      <Button
                        size="small"
                        icon={<UndoOutlined />}
                        loading={busy === `unpay-${inst.id}`}
                        onClick={() => void run(`unpay-${inst.id}`, () => unpayInstallment(inst.id), "Pago revertido")}
                      >
                        Revertir
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="small" type={late ? "primary" : "default"} onClick={() => setPayTarget(payTargetOf(inst))}>
                        Pagar
                      </Button>
                      <Button size="small" type="text" icon={<EditOutlined />} aria-label={`Cambiar la cuota ${k}`} onClick={() => setEditInst(inst)} />
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label={`Borrar la cuota ${k}`}
                        loading={busy === `del-${inst.id}`}
                        onClick={() => removeInstallment(inst, k)}
                      />
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <PayInstallmentModal target={payTarget} onClose={() => setPayTarget(null)} onDone={setCredit} />
      <InstallmentEditModal installment={editInst} onClose={() => setEditInst(null)} onDone={setCredit} />
      <CreditFormModal open={editOpen} credit={credit} onClose={() => setEditOpen(false)} onDone={setCredit} />
      <ReplanModal open={replanOpen} credit={credit} onClose={() => setReplanOpen(false)} onDone={setCredit} />
    </div>
  );
}
