import { DeleteOutlined, EditOutlined, InboxOutlined, PlusOutlined, UndoOutlined } from "@ant-design/icons";
import { App, Button, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { archiveFinanceAccount, fetchFinanceAccounts, purgeFinanceAccount, restoreFinanceAccount } from "../api";
import { AccountFormModal } from "../components/AccountFormModal";
import { BackupCard } from "../components/BackupCard";
import { EmptyState } from "../components/bits";
import { useFinanceContext } from "../context/FinanceContext";
import { ACCOUNT_TYPE_LABELS, type FinanceAccount } from "../types";

export function AccountsPage() {
  const { message, modal, notification } = App.useApp();
  const { reloadAccounts } = useFinanceContext();
  const [all, setAll] = useState<FinanceAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FinanceAccount | null>(null);
  const [open, setOpen] = useState(false);

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
  }, [load]);

  const refresh = async () => {
    await Promise.all([load(), reloadAccounts()]);
  };

  const active = (all ?? []).filter((a) => !a.archivedAt);
  const archived = (all ?? []).filter((a) => a.archivedAt);

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
        description: "Sus ingresos y créditos dejan de salir. Puedes restaurarla cuando quieras.",
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
      content: "Se borran también todos sus ingresos y créditos, con sus cuotas. No se puede deshacer. Si quieres, descarga antes un respaldo.",
      okText: "Borrar para siempre",
      okType: "danger",
      cancelText: "Volver",
      onOk: async () => {
        try {
          await purgeFinanceAccount(account.id);
          message.success("Cuenta borrada");
          await refresh();
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo borrar"));
        }
      },
    });
  };

  return (
    <div className="ff-page">
      <div className="ff-pagehead">
        <div>
          <h1 className="ff-title">Cuentas</h1>
          <p className="ff-subtitle">Cada cuenta agrupa sus ingresos y créditos, por ejemplo «Personal» y «Negocio».</p>
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
        <EmptyState title="Todavía no tienes cuentas" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Crear la primera</Button>}>
          Crea «Personal» para tu plata y, si tienes, «Negocio» para la del negocio.
        </EmptyState>
      )}

      {active.length > 0 && (
        <div className="ff-accounts">
          {active.map((a) => (
            <article key={a.id} className="ff-account" style={{ ["--ff-account" as string]: a.color ?? undefined }}>
              <div style={{ display: "grid", gap: 2 }}>
                <h2 className="ff-account__name">{a.name}</h2>
                <span className="ff-hint">
                  {ACCOUNT_TYPE_LABELS[a.type]} · {a.currency}
                </span>
              </div>
              <div className="ff-actions">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(a);
                    setOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button size="small" icon={<InboxOutlined />} onClick={() => void archive(a)}>
                  Archivar
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

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
                    {ACCOUNT_TYPE_LABELS[a.type]} · archivada el {new Date(a.archivedAt as string).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
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

      <BackupCard onImported={() => void refresh()} />

      <AccountFormModal open={open} account={editing} onClose={() => setOpen(false)} onDone={() => void refresh()} />
    </div>
  );
}
