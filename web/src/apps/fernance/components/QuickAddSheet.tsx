import { DeleteOutlined, PushpinOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Drawer, Input, Segmented } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { todayKey } from "../../../utils/dates";
import { apiErrorMessage } from "../../habitfer/format";
import {
  createShortcut,
  createTransaction,
  deleteTransaction,
  fetchQuick,
  parseMoneyText,
  teachKeyword,
  updateTransaction,
} from "../api";
import { useFinanceContext, type QuickAddRequest } from "../context/FinanceContext";
import { formatCop } from "../money";
import { keypadPress } from "../movements";
import {
  ENTRY_TYPE_LABELS,
  type EntryType,
  type FinanceAccount,
  type FinanceAccountType,
  type MovementItem,
  type ParseResult,
  type QuickData,
  type TransactionPayload,
} from "../types";
import { AccountChips } from "./AccountChips";
import { CategoryChips, CategoryPickerModal } from "./CategoryPicker";
import { Keypad } from "./Keypad";
import { MoneyInput } from "./MoneyInput";

type Draft = {
  type: EntryType;
  /** El monto en dígitos (sin puntos). */
  digits: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  date: string;
  note: string;
  merchant: string;
};

const lastKey = (t: EntryType) => `ff_last_account_${t}`;
function rememberAccount(t: EntryType, id: string) {
  try {
    localStorage.setItem(lastKey(t), id);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}
function lastAccount(t: EntryType): string | null {
  try {
    return localStorage.getItem(lastKey(t));
  } catch {
    return null;
  }
}

/** Sin cuenta recordada: una del día a día (Nequi, ahorros, efectivo) del libro que se mira, o Personal. */
const DAILY_KINDS: FinanceAccount["kind"][] = ["WALLET", "SAVINGS", "CASH", "CHECKING", "CREDIT_CARD", "INVESTMENT", "OTHER"];

function defaultAccount(type: EntryType, accounts: FinanceAccount[], scope: { accountId: string | null; book: FinanceAccountType | null }) {
  const valid = (id: string | null | undefined) => (id && accounts.some((a) => a.id === id) ? id : null);
  const book = scope.book ?? "PERSONAL";
  const inBook = accounts.filter((a) => a.type === book);
  const pool = inBook.length ? inBook : accounts;
  const daily = [...pool].sort((a, b) => DAILY_KINDS.indexOf(a.kind) - DAILY_KINDS.indexOf(b.kind))[0];
  return valid(scope.accountId) ?? valid(lastAccount(type)) ?? daily?.id ?? null;
}

function initialDraft(req: QuickAddRequest, accounts: FinanceAccount[], scope: { accountId: string | null; book: FinanceAccountType | null }): Draft {
  const edit = req.edit;
  if (edit && edit.kind === "tx") {
    return {
      type: edit.type === "INCOME" || edit.type === "TRANSFER" ? edit.type : "EXPENSE",
      digits: String(Math.round(Math.abs(edit.amount))),
      accountId: edit.accountId,
      toAccountId: edit.toAccountId,
      categoryId: edit.categoryId,
      date: edit.date,
      note: edit.note ?? "",
      merchant: edit.merchant ?? "",
    };
  }
  const type = req.type ?? "EXPENSE";
  const accountId = req.accountId ?? defaultAccount(type, accounts, scope);
  return {
    type,
    digits: "",
    accountId,
    toAccountId: req.toAccountId ?? (type === "TRANSFER" ? (accounts.find((a) => a.id !== accountId)?.id ?? null) : null),
    categoryId: null,
    date: todayKey(),
    note: "",
    merchant: "",
  };
}

/** Lo que se dice al anotar: «en Almuerzo, desde Nequi». */
function describe(item: MovementItem): string {
  if (item.type === "TRANSFER") return `De ${item.accountName} a ${item.toAccountName ?? "otra cuenta"}.`;
  if (item.type === "INCOME") return `${item.categoryName ? `${item.categoryName}, ` : ""}en ${item.accountName}.`;
  return `${item.categoryName ? `En ${item.categoryName}, d` : "D"}esde ${item.accountName}.`;
}

/** La hoja de «Anotar»: gasto, ingreso o transferencia en segundos. También edita un movimiento. */
export function QuickAddSheet() {
  const { quickAdd, closeQuickAdd } = useFinanceContext();
  const isMobile = useIsMobile();
  const edit = quickAdd?.edit ?? null;
  const title = edit ? (edit.type === "ADJUSTMENT" ? "Ajuste de saldo" : "Editar movimiento") : "Anotar";

  return (
    <Drawer
      title={title}
      open={quickAdd !== null}
      onClose={closeQuickAdd}
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "92dvh" : 500}
      rootClassName="ff-drawer"
      destroyOnHidden
      styles={{
        // La hoja no se desliza entera: arriba se desliza lo que se escoge y abajo queda fijo el monto, el
        // teclado y el botón de guardar.
        body: {
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: 0,
        },
        wrapper: isMobile ? { maxWidth: "100vw" } : undefined,
      }}
    >
      {quickAdd && <QuickAddBody request={quickAdd} />}
    </Drawer>
  );
}

function QuickAddBody({ request }: { request: QuickAddRequest }) {
  const { message, modal, notification } = App.useApp();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { accounts, categories, accountId: scopeAccount, book, closeQuickAdd, bumpData } = useFinanceContext();
  const edit = request.edit?.kind === "tx" ? request.edit : null;
  const isAdjustment = edit?.type === "ADJUSTMENT";
  const [draft, setDraft] = useState<Draft>(() => initialDraft(request, accounts, { accountId: scopeAccount, book }));
  const [adjustSign, setAdjustSign] = useState<1 | -1>(edit && edit.amount < 0 ? -1 : 1);
  const [text, setText] = useState("");
  const [textFocused, setTextFocused] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [parseNonce, setParseNonce] = useState(0);
  const [teachWord, setTeachWord] = useState<string | null>(null);
  const [quick, setQuick] = useState<QuickData | null>(null);
  const [showMerchant, setShowMerchant] = useState(Boolean(edit?.merchant));
  const [saving, setSaving] = useState(false);
  const today = todayKey();

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const amount = Number(draft.digits || 0);
  const transfer = draft.type === "TRANSFER";
  const kind = draft.type === "INCOME" ? "INCOME" : "EXPENSE";

  // «Lo de siempre» (solo al anotar algo nuevo).
  useEffect(() => {
    if (edit) return;
    let alive = true;
    fetchQuick()
      .then((q) => alive && setQuick(q))
      .catch(() => alive && setQuick({ shortcuts: [], suggestions: [] }));
    return () => {
      alive = false;
    };
  }, [edit]);

  // «Escribe como hablas»: se entiende mientras se escribe.
  useEffect(() => {
    if (edit) return;
    const t = text.trim();
    if (t.length < 2) {
      setParsed(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      parseMoneyText(t, ctrl.signal)
        .then((r) => {
          setParsed(r);
          setDraft((d) => {
            const type = r.type;
            const accountId = r.accountId ?? d.accountId;
            return {
              ...d,
              type,
              digits: r.amount ? String(r.amount) : d.digits,
              accountId,
              toAccountId: type === "TRANSFER" ? (r.toAccountId ?? (d.toAccountId !== accountId ? d.toAccountId : null)) : null,
              categoryId: r.categoryId ?? (type === d.type ? d.categoryId : null),
              date: r.date,
              note: r.note ?? "",
              merchant: r.merchant ?? "",
            };
          });
          if (r.merchant) setShowMerchant(true);
        })
        .catch(() => {
          /* se canceló o falló: el formulario sigue a mano */
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, edit, parseNonce]);

  const close = () => closeQuickAdd();

  const afterCreate = (item: MovementItem) => {
    close();
    bumpData();
    const key = `tx-${item.id}`;
    notification.open({
      key,
      title: `Anotado: ${formatCop(item.amount)}`,
      description: describe(item),
      placement: isMobile ? "top" : "bottomRight",
      duration: 6,
      actions: (
        <Button
          size="small"
          onClick={() => {
            notification.destroy(key);
            void deleteTransaction(item.id)
              .then(() => {
                bumpData();
                message.success("Listo, se quitó");
              })
              .catch((err: unknown) => message.error(apiErrorMessage(err, "No se pudo deshacer")));
          }}
        >
          Deshacer
        </Button>
      ),
    });
  };

  const canSave =
    amount >= 1 &&
    Boolean(draft.accountId) &&
    (!transfer || (Boolean(draft.toAccountId) && draft.toAccountId !== draft.accountId));

  const save = async () => {
    if (!canSave || !draft.accountId) return;
    setSaving(true);
    try {
      if (edit) {
        await updateTransaction(
          edit.id,
          isAdjustment
            ? { amount: adjustSign * amount, date: draft.date, note: draft.note.trim() }
            : {
                type: draft.type,
                accountId: draft.accountId,
                toAccountId: transfer ? draft.toAccountId : null,
                amount,
                date: draft.date,
                categoryId: transfer ? null : draft.categoryId,
                note: draft.note.trim(),
                ...(transfer ? {} : { merchant: draft.merchant.trim() }),
              },
        );
        message.success("Movimiento actualizado");
        bumpData();
        close();
      } else {
        const raw = text.trim();
        const payload: TransactionPayload = {
          type: draft.type,
          accountId: draft.accountId,
          ...(transfer && draft.toAccountId ? { toAccountId: draft.toAccountId } : {}),
          amount,
          date: draft.date,
          ...(transfer ? {} : { categoryId: draft.categoryId }),
          ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
          ...(!transfer && draft.merchant.trim() ? { merchant: draft.merchant.trim() } : {}),
          source: raw ? "TEXT" : "MANUAL",
          ...(raw ? { rawText: raw } : {}),
        };
        const item = await createTransaction(payload);
        rememberAccount(draft.type, draft.accountId);
        afterCreate(item);
      }
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  };

  const saveShortcut = async (s: { type: "INCOME" | "EXPENSE"; accountId: string; amount: number; categoryId: string | null; merchant: string | null; label: string | null }) => {
    setSaving(true);
    try {
      const item = await createTransaction({
        type: s.type,
        accountId: s.accountId,
        amount: s.amount,
        date: today,
        categoryId: s.categoryId,
        ...(s.label ? { note: s.label } : {}),
        ...(s.merchant ? { merchant: s.merchant } : {}),
        source: "SHORTCUT",
      });
      afterCreate(item);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo anotar"));
    } finally {
      setSaving(false);
    }
  };

  const pinSuggestion = async (s: QuickData["suggestions"][number]) => {
    const name = s.label ?? categories.find((c) => c.id === s.categoryId)?.name ?? "Lo de siempre";
    try {
      await createShortcut({
        label: name.slice(0, 40),
        type: s.type,
        amount: s.amount,
        accountId: s.accountId,
        categoryId: s.categoryId,
        ...(s.merchant ? { merchant: s.merchant } : {}),
      });
      setQuick(await fetchQuick());
      message.success(`«${name}» quedó en lo de siempre`);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    }
  };

  const saveAsShortcut = async () => {
    if (!edit || !draft.accountId || transfer || amount < 1) return;
    const name = (draft.note.trim() || draft.merchant.trim() || categories.find((c) => c.id === draft.categoryId)?.name || "Lo de siempre").slice(0, 40);
    try {
      await createShortcut({
        label: name,
        type: kind,
        amount,
        accountId: draft.accountId,
        categoryId: draft.categoryId,
        ...(draft.merchant.trim() ? { merchant: draft.merchant.trim() } : {}),
      });
      message.success(`«${name}» quedó en lo de siempre: la próxima vez es un toque`);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    }
  };

  const remove = () => {
    if (!edit) return;
    modal.confirm({
      title: "¿Borrar este movimiento?",
      content: `${edit.title} por ${formatCop(Math.abs(edit.amount))}.`,
      okText: "Borrar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteTransaction(edit.id);
          close();
          bumpData();
          if (edit.type === "ADJUSTMENT") {
            message.success("Ajuste borrado");
            return;
          }
          const key = `del-${edit.id}`;
          notification.open({
            key,
            title: "Movimiento borrado",
            description: `${edit.title} por ${formatCop(edit.amount)}.`,
            placement: isMobile ? "top" : "bottomRight",
            duration: 6,
            actions: (
              <Button
                size="small"
                onClick={() => {
                  notification.destroy(key);
                  void createTransaction({
                    type: edit.type as EntryType,
                    accountId: edit.accountId,
                    ...(edit.toAccountId ? { toAccountId: edit.toAccountId } : {}),
                    amount: edit.amount,
                    date: edit.date,
                    ...(edit.type === "TRANSFER" ? {} : { categoryId: edit.categoryId }),
                    ...(edit.note ? { note: edit.note } : {}),
                    ...(edit.merchant && edit.type !== "TRANSFER" ? { merchant: edit.merchant } : {}),
                  })
                    .then(() => {
                      bumpData();
                      message.success("Listo, volvió");
                    })
                    .catch((err: unknown) => message.error(apiErrorMessage(err, "No se pudo deshacer")));
                }}
              >
                Deshacer
              </Button>
            ),
          });
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo borrar"));
        }
      },
    });
  };

  const shortcutChips = useMemo(() => {
    if (!quick) return [];
    return [
      ...quick.shortcuts.map((s) => ({ key: s.id, pinned: true as const, s: { ...s, label: s.label }, icon: s.icon })),
      ...quick.suggestions.map((s, i) => ({ key: `sug-${i}`, pinned: false as const, s, icon: null as string | null })),
    ];
  }, [quick]);

  if (!accounts.length) {
    return (
      <div className="ff-empty">
        <h3>Primero crea una cuenta</h3>
        <p>Por ejemplo tu cuenta de ahorros, Nequi o el efectivo. Ahí se anotan tus gastos e ingresos.</p>
        <Button
          type="primary"
          onClick={() => {
            close();
            navigate("/app/fernance/accounts");
          }}
        >
          Ir a mis cuentas
        </Button>
      </div>
    );
  }

  const amountText = amount ? formatCop(amount) : "$ 0";

  const adjustToggle = isAdjustment && (
    <Segmented
      aria-label="El ajuste subió o bajó el saldo"
      value={adjustSign}
      onChange={(v) => setAdjustSign(v as 1 | -1)}
      options={[
        { value: 1, label: "Subió" },
        { value: -1, label: "Bajó" },
      ]}
    />
  );

  return (
    <div className="ff-qa">
      <div className="ff-qa__scroll">
        {!isAdjustment && (
          <Segmented
            block
            aria-label="Qué vas a anotar"
            value={draft.type}
            onChange={(v) => {
              const type = v as EntryType;
              set({
                type,
                categoryId: null,
                toAccountId: type === "TRANSFER" ? (accounts.find((a) => a.id !== draft.accountId)?.id ?? null) : null,
              });
            }}
            options={(["EXPENSE", "INCOME", "TRANSFER"] as EntryType[]).map((t) => ({ value: t, label: ENTRY_TYPE_LABELS[t] }))}
          />
        )}

        {!edit && (
          <div className="ff-qa__speak">
            <Input
              size="large"
              allowClear
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setTextFocused(true)}
              onBlur={() => setTextFocused(false)}
              onPressEnter={() => void save()}
              placeholder="Escribe como hablas: almuerzo 18 lucas nequi"
              aria-label="Escribe como hablas"
              maxLength={300}
            />
            {parsed && (parsed.hints.length > 0 || parsed.unknown.length > 0) && (
              <div className="ff-qa__hints">
                {parsed.hints.map((h) => (
                  <p key={h} className="ff-hint">
                    {h}
                  </p>
                ))}
                {parsed.unknown.length > 0 && (
                  <div className="ff-chips" role="group" aria-label="Palabras para enseñar">
                    <span className="ff-hint">¿No entendí? Enséñame:</span>
                    {parsed.unknown.map((w) => (
                      <button key={w} type="button" className="ff-pick ff-pick--teach" onClick={() => setTeachWord(w)}>
                        «{w}» es…
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!edit && !text && shortcutChips.length > 0 && (
          <section aria-label="Lo de siempre" className="ff-qa__section">
            <span className="ff-qa__label">Lo de siempre</span>
            <div className="ff-chips">
              {shortcutChips.map(({ key, pinned, s, icon }) => {
                const cat = categories.find((c) => c.id === s.categoryId);
                const label = s.label ?? cat?.name ?? "Lo de siempre";
                return (
                  <span key={key} className={`ff-shortcut${pinned ? "" : " is-suggested"}`}>
                    <button
                      type="button"
                      className="ff-shortcut__use"
                      disabled={saving}
                      onClick={() => void saveShortcut(s)}
                      aria-label={`Anotar ${label} por ${formatCop(s.amount)}`}
                    >
                      <span aria-hidden="true">{icon ?? cat?.icon ?? "⭐"}</span>
                      {label} · {formatCop(s.amount)}
                    </button>
                    {!pinned && (
                      <button
                        type="button"
                        className="ff-shortcut__pin"
                        onClick={() => void pinSuggestion(s)}
                        aria-label={`Guardar ${label} en lo de siempre`}
                        title="Guardar en lo de siempre"
                      >
                        <PushpinOutlined />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {!isMobile && (
          <div className="ff-qa__amount">
            {adjustToggle}
            <MoneyInput
              size="large"
              aria-label="Monto"
              placeholder="Monto"
              value={amount || undefined}
              onChange={(v) => set({ digits: v ? String(Math.round(Number(v))) : "" })}
              autoFocus={Boolean(edit)}
            />
          </div>
        )}

        {!transfer && !isAdjustment && (
          <section className="ff-qa__section" aria-label="Categoría">
            <span className="ff-qa__label">Categoría</span>
            <CategoryChips kind={kind} value={draft.categoryId} onChange={(id) => set({ categoryId: id })} />
          </section>
        )}

        {!isAdjustment && (
          <section className="ff-qa__section">
            <span className="ff-qa__label">{draft.type === "INCOME" ? "Entra a" : "Sale de"}</span>
            <AccountChips
              label={transfer ? "Cuenta de salida" : "Cuenta"}
              value={draft.accountId}
              onChange={(id) => set({ accountId: id, ...(draft.toAccountId === id ? { toAccountId: null } : {}) })}
            />
            {transfer && (
              <>
                <span className="ff-qa__label">Llega a</span>
                <AccountChips label="Cuenta de llegada" value={draft.toAccountId} exclude={draft.accountId} onChange={(id) => set({ toAccountId: id })} />
              </>
            )}
          </section>
        )}

        <section className="ff-qa__section" aria-label="Fecha">
          <span className="ff-qa__label">Fecha</span>
          <div className="ff-chips">
            <button type="button" className="ff-pick" aria-pressed={draft.date === today} onClick={() => set({ date: today })}>
              Hoy
            </button>
            <button
              type="button"
              className="ff-pick"
              aria-pressed={draft.date === dayjs(today).subtract(1, "day").format("YYYY-MM-DD")}
              onClick={() => set({ date: dayjs(today).subtract(1, "day").format("YYYY-MM-DD") })}
            >
              Ayer
            </button>
            <DatePicker
              aria-label="Otra fecha"
              value={dayjs(draft.date)}
              onChange={(d) => d && set({ date: d.format("YYYY-MM-DD") })}
              format="D MMM YYYY"
              allowClear={false}
              inputReadOnly={isMobile}
              disabledDate={(d) => d.isAfter(dayjs(today), "day")}
              style={{ width: 150 }}
            />
          </div>
        </section>

        <section className="ff-qa__section">
          <Input
            value={draft.note}
            onChange={(e) => set({ note: e.target.value })}
            onFocus={() => setTextFocused(true)}
            onBlur={() => setTextFocused(false)}
            placeholder={transfer ? "Nota (opcional)" : "Nota (opcional): almuerzo con Juan…"}
            aria-label="Nota"
            maxLength={300}
          />
          {!transfer &&
            !isAdjustment &&
            (showMerchant ? (
              <Input
                value={draft.merchant}
                onChange={(e) => set({ merchant: e.target.value })}
                onFocus={() => setTextFocused(true)}
                onBlur={() => setTextFocused(false)}
                placeholder="Comercio (D1, Rappi, Terpel…)"
                aria-label="Comercio"
                maxLength={120}
              />
            ) : (
              <Button type="link" size="small" className="ff-more" onClick={() => setShowMerchant(true)}>
                + Comercio
              </Button>
            ))}
        </section>

        {edit && (
          <div className="ff-actions" style={{ justifyContent: "space-between" }}>
            <Button danger icon={<DeleteOutlined />} onClick={remove}>
              Borrar
            </Button>
            {!transfer && !isAdjustment && (
              <Button icon={<PushpinOutlined />} onClick={() => void saveAsShortcut()} disabled={amount < 1}>
                Guardar como «lo de siempre»
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="ff-qa__dock">
        {isMobile && (
          <>
            {adjustToggle}
            <output className={`ff-qa__display${amount ? "" : " is-empty"}`} aria-live="polite" aria-label={`Monto: ${amountText}`}>
              {amountText}
            </output>
            {!textFocused && <Keypad onKey={(k) => set({ digits: keypadPress(draft.digits, k) })} />}
          </>
        )}
        <Button type="primary" size="large" block disabled={!canSave} loading={saving} onClick={() => void save()}>
          {edit ? "Guardar cambios" : canSave ? `Anotar ${formatCop(amount)}` : transfer ? "Falta el monto o las cuentas" : "Escribe el monto"}
        </Button>
      </div>

      <CategoryPickerModal
        open={teachWord !== null}
        kind={kind}
        title={teachWord ? `¿Qué es «${teachWord}»?` : undefined}
        intro="Lo recuerdo para la próxima vez que lo escribas."
        onClose={() => setTeachWord(null)}
        onPick={(categoryId) => {
          const word = teachWord;
          setTeachWord(null);
          if (!word) return;
          const cat = categories.find((c) => c.id === categoryId);
          void teachKeyword({ keyword: word, categoryId })
            .then(() => {
              message.success(`Listo: «${word}» es ${cat?.name ?? "esa categoría"}`);
              setParseNonce((n) => n + 1);
            })
            .catch((err: unknown) => message.error(apiErrorMessage(err, "No se pudo enseñar la palabra")));
        }}
      />
    </div>
  );
}
