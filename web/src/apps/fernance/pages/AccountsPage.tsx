import { DeleteOutlined, EditOutlined, InboxOutlined, PlusOutlined, RightOutlined, UndoOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { App, Button, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { todayKey } from "../../../utils/dates";
import { apiErrorMessage } from "../../habitfer/format";
import { archiveFinanceAccount, fetchFinanceAccounts, purgeFinanceAccount, restoreFinanceAccount } from "../api";
import { AccountFormModal } from "../components/AccountFormModal";
import { BackupCard } from "../components/BackupCard";
import { EmptyState, longDate } from "../components/bits";
import { ReconcileModal } from "../components/ReconcileModal";
import { useFinanceContext } from "../context/FinanceContext";
import { formatCop } from "../money";
import {
  ACCOUNT_KIND_ICONS,
  ACCOUNT_KIND_LABELS,
  ACCOUNT_TYPE_LABELS,
  type FinanceAccount,
  type FinanceAccountType,
} from "../types";

const BASE = "/app/fernance";
const BOOKS: FinanceAccountType[] = ["PERSONAL", "BUSINESS", "OTHER"];

function Balance({ account }: { account: FinanceAccount }) {
  const b = account.balance ?? 0;
  if (account.kind === "CREDIT_CARD" && b < 0) return <span className="ff-account__balance is-debt">Debes {formatCop(-b)}</span>;
  return <span className={`ff-account__balance${b < 0 ? " is-debt" : ""}`}>{formatCop(b)}</span>;
}

export function AccountsPage() {
  const { message, modal, notification } = App.useApp();
  const navigate = useNavigate();
  const { reloadAccounts, setScope, bumpData, dataVersion } = useFinanceContext();
  const [all, setAll] = useState<FinanceAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FinanceAccount | null>(null);
  const [open, setOpen] = useState(false);
  const [reconciling, setReconciling] = useState<FinanceAccount | null>(null);
  const today = todayKey();

  const load = useCallback(async () => {
    try {
      setError(null);
      setAll(await fetchFinanceAccounts({ archived: true }));
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudieron cargar las cuentas."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  const refresh = async () => {
    await Promise.all([load(), reloadAccounts()]);
  };

  const active = (all ?? []).filter((a) => !a.archivedAt);
  const archived = (all ?? []).filter((a) => a.archivedAt);
  const total = active.reduce((s, a) => s + (a.balance ?? 0), 0);
  const books = BOOKS.filter((b) => active.some((a) => a.type === b));
  const legacy = active.filter((a) => a.kind === "OTHER");

  const restore = async (account: FinanceAccount, quiet = false) => {
    try {
      await restoreFinanceAccount(account.id);
      if (!quiet) message.success(`«${account.name}» volvió a tus cuentas`);
      await refresh();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo restaurar"));
    }
  };

  const archive = async (account: FinanceAccount) => {
    try {
      await archiveFinanceAccount(account.id);
      await refresh();
      const key = `archive-${account.id}`;
      notification.open({
        key,
        title: `«${account.name}» está en la papelera`,
        description: "Sus movimientos y créditos dejan de salir. Puedes restaurarla cuando quieras.",
        actions: (
          <Button
            type="primary"
            size="small"
            onClick={() => {
              notification.destroy(key);
              void restore(account, true).then(() => message.success("Listo, la cuenta volvió"));
            }}
          >
            Deshacer
          </Button>
        ),
        duration: 8,
      });
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo archivar"));
    }
  };

  const purge = (account: FinanceAccount) => {
    modal.confirm({
      title: `¿Borrar «${account.name}» para siempre?`,
      content:
        "Se borran también sus movimientos y créditos, con sus cuotas. Las transferencias con tus otras cuentas quedan en ellas como ingreso o gasto, para que sus saldos no cambien. No se puede deshacer: si quieres, descarga antes un respaldo.",
      okText: "Borrar para siempre",
      okType: "danger",
      cancelText: "Volver",
      onOk: async () => {
        try {
          await purgeFinanceAccount(account.id);
          message.success("Cuenta borrada");
          await refresh();
          bumpData();
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo borrar"));
        }
      },
    });
  };

  const seeMovements = (account: FinanceAccount) => {
    setScope({ accountId: account.id });
    navigate(`${BASE}/movements`);
  };

  const reconcileLine = (a: FinanceAccount) => {
    if (!a.reconciledAt) return <span className="ff-hint">Sin cuadrar con el banco</span>;
    if (a.reconcileStale)
      return <span className="ff-account__check is-stale">⚠ Ya no cuadra: cambió algo de lo cuadrado el {longDate(a.reconciledAt, today)}</span>;
    return <span className="ff-account__check">✓ Cuadrada el {longDate(a.reconciledAt, today)}</span>;
  };

  return (
    <div className="ff-page">
      <div className="ff-pagehead">
        <div>
          <h1 className="ff-title">Cuentas</h1>
          <p className="ff-subtitle">
            {all && active.length
              ? `Tienes ${formatCop(total)} en ${active.length === 1 ? "1 cuenta" : `${active.length} cuentas`} (las tarjetas restan lo que debes).`
              : "Tus cuentas de verdad: ahorros, Nequi, efectivo y tarjetas, cada una con su saldo."}
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Nueva cuenta
        </Button>
      </div>

      {error && (
        <EmptyState title="No se pudieron cargar las cuentas" action={<Button onClick={() => void load()}>Reintentar</Button>}>
          {error}
        </EmptyState>
      )}
      {!all && !error && <Skeleton active paragraph={{ rows: 4 }} />}

      {all && active.length === 0 && (
        <EmptyState
          title="Todavía no tienes cuentas"
          action={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              Crear la primera
            </Button>
          }
        >
          Crea tu cuenta de ahorros, Nequi o el efectivo, con lo que tienen hoy. Personal y Negocio se llevan como dos libros
          separados.
        </EmptyState>
      )}

      {legacy.length > 0 && (
        <section className="ff-card ff-card--note" aria-labelledby="ff-legacy-title">
          <h2 id="ff-legacy-title" className="ff-section-title">
            Dile a FerFinance qué es cada cuenta
          </h2>
          <p className="ff-hint">
            {legacy.map((a) => `«${a.name}»`).join(" y ")} {legacy.length === 1 ? "viene" : "vienen"} de antes, cuando una cuenta agrupaba
            todo. Dile qué es de verdad (por ejemplo, tu cuenta de Bancolombia) y cuádrala con el banco para que su saldo sea el
            real. Lo que ya anotaste se queda igual.
          </p>
          <div className="ff-actions">
            {legacy.map((a) => (
              <Button
                key={a.id}
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(a);
                  setOpen(true);
                }}
              >
                ¿Qué es «{a.name}»?
              </Button>
            ))}
          </div>
        </section>
      )}

      {books.map((b) => {
        const list = active.filter((a) => a.type === b);
        const bookTotal = list.reduce((s, a) => s + (a.balance ?? 0), 0);
        return (
          <section key={b} className="ff-book" aria-labelledby={`ff-book-${b}`}>
            <div className="ff-book__head">
              <h2 id={`ff-book-${b}`} className="ff-section-title">
                {books.length > 1 ? `Libro ${ACCOUNT_TYPE_LABELS[b]}` : "Tus cuentas"}
              </h2>
              <span className={`ff-amount${bookTotal < 0 ? " ff-amount--out" : ""}`}>{formatCop(bookTotal)}</span>
            </div>
            <div className="ff-accounts">
              {list.map((a) => (
                <article key={a.id} className="ff-account" style={{ ["--ff-account" as string]: a.color ?? undefined }}>
                  <div className="ff-account__top">
                    <span className="ff-account__icon" aria-hidden="true">
                      {ACCOUNT_KIND_ICONS[a.kind]}
                    </span>
                    <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                      <h3 className="ff-account__name">{a.name}</h3>
                      <span className="ff-hint">
                        {ACCOUNT_KIND_LABELS[a.kind]}
                        {a.institution && a.institution !== a.name ? ` · ${a.institution}` : ""}
                        {a.last4 ? ` · •••• ${a.last4}` : ""}
                      </span>
                    </div>
                  </div>
                  <Balance account={a} />
                  {reconcileLine(a)}
                  <div className="ff-actions">
                    <Button size="small" icon={<UnorderedListOutlined />} onClick={() => seeMovements(a)}>
                      Movimientos
                    </Button>
                    <Button size="small" onClick={() => setReconciling(a)}>
                      Cuadrar
                    </Button>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      aria-label={`Editar ${a.name}`}
                      onClick={() => {
                        setEditing(a);
                        setOpen(true);
                      }}
                    />
                    <Button size="small" icon={<InboxOutlined />} aria-label={`Archivar ${a.name}`} onClick={() => void archive(a)} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <button type="button" className="ff-linkcard" onClick={() => navigate(`${BASE}/categories`)}>
        <span>
          <b>Categorías, palabras y «lo de siempre»</b>
          <span className="ff-hint">Tus categorías con sus íconos, las palabras que le enseñaste y lo que anotas con un toque.</span>
        </span>
        <RightOutlined aria-hidden="true" />
      </button>

      {archived.length > 0 && (
        <section className="ff-card" aria-labelledby="ff-trash-title">
          <h2 id="ff-trash-title" className="ff-section-title">
            Papelera
          </h2>
          <p className="ff-hint">Lo de estas cuentas no sale en ningún lado. Restáuralas para volver a usarlas.</p>
          <div className="ff-accounts">
            {archived.map((a) => (
              <article key={a.id} className="ff-account ff-account--archived" style={{ ["--ff-account" as string]: a.color ?? undefined }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <h3 className="ff-account__name">{a.name}</h3>
                  <span className="ff-hint">
                    {ACCOUNT_KIND_LABELS[a.kind]} · archivada el{" "}
                    {new Date(a.archivedAt as string).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <div className="ff-actions">
                  <Button size="small" icon={<UndoOutlined />} onClick={() => void restore(a)}>
                    Restaurar
                  </Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => purge(a)}>
                    Borrar para siempre
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <BackupCard onImported={bumpData} />

      <AccountFormModal open={open} account={editing} onClose={() => setOpen(false)} onDone={bumpData} />
      <ReconcileModal account={reconciling} onClose={() => setReconciling(null)} onDone={bumpData} />
    </div>
  );
}
