import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, InboxOutlined, PlusOutlined, UndoOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal, Segmented, Select, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiErrorMessage } from "../../habitfer/format";
import {
  archiveCategory,
  deleteKeyword,
  deleteShortcut,
  fetchCategories,
  fetchKeywords,
  fetchQuick,
  restoreCategory,
  teachKeyword,
  updateShortcut,
} from "../api";
import { EmptyState } from "../components/bits";
import { CategoryFormModal } from "../components/CategoryFormModal";
import { MoneyInput } from "../components/MoneyInput";
import { useFinanceContext } from "../context/FinanceContext";
import { formatCop } from "../money";
import { categoryLabel, categoryTree } from "../movements";
import type { CategoryKind, FinanceCategory, FinanceKeyword, FinanceShortcut } from "../types";

type FormState = { category?: FinanceCategory | null; parentId?: string | null } | null;

export function CategoriesPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { reloadCategories, accounts } = useFinanceContext();
  const [kind, setKind] = useState<CategoryKind>("EXPENSE");
  const [all, setAll] = useState<FinanceCategory[] | null>(null);
  const [keywords, setKeywords] = useState<FinanceKeyword[] | null>(null);
  const [shortcuts, setShortcuts] = useState<FinanceShortcut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(null);
  const [word, setWord] = useState("");
  const [target, setTarget] = useState<string | undefined>();
  const [editing, setEditing] = useState<FinanceShortcut | null>(null);
  const [shortcutForm] = Form.useForm<{ label: string; amount: number; icon?: string }>();

  const load = useCallback(async () => {
    try {
      setError(null);
      const [cats, kws, quick] = await Promise.all([fetchCategories({ archived: true }), fetchKeywords(), fetchQuick()]);
      setAll(cats);
      setKeywords(kws);
      setShortcuts(quick.shortcuts);
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudieron cargar las categorías."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    await Promise.all([load(), reloadCategories()]);
  };

  const list = all ?? [];
  const tree = categoryTree(list, kind);
  const archived = list.filter((c) => c.kind === kind && c.archivedAt && (!c.parentId || !list.find((p) => p.id === c.parentId)?.archivedAt));

  const archive = async (c: FinanceCategory) => {
    try {
      await archiveCategory(c.id);
      message.success(`«${c.name}» archivada: ya no sale para elegir, pero tus movimientos la conservan`);
      await refresh();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo archivar"));
    }
  };

  const restore = async (c: FinanceCategory) => {
    try {
      await restoreCategory(c.id);
      message.success(`«${c.name}» volvió`);
      await refresh();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo restaurar"));
    }
  };

  const teach = async () => {
    if (!word.trim() || !target) return;
    try {
      const [k, id] = target.split(":");
      await teachKeyword({ keyword: word.trim(), ...(k === "cat" ? { categoryId: id } : { accountId: id }) });
      message.success(`Listo: ya entiendo «${word.trim()}»`);
      setWord("");
      setTarget(undefined);
      setKeywords(await fetchKeywords());
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo enseñar la palabra"));
    }
  };

  const saveShortcut = async () => {
    if (!editing) return;
    const v = await shortcutForm.validateFields();
    try {
      await updateShortcut(editing.id, { label: v.label.trim(), amount: v.amount, icon: (v.icon ?? "").trim() });
      message.success("Guardado");
      setEditing(null);
      setShortcuts((await fetchQuick()).shortcuts);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    }
  };

  const targetOptions = [
    ...(["EXPENSE", "INCOME"] as CategoryKind[]).map((k) => ({
      label: k === "EXPENSE" ? "Categorías de gastos" : "Categorías de ingresos",
      title: k,
      options: categoryTree(list, k).flatMap(({ parent, children }) => [
        { value: `cat:${parent.id}`, label: `${parent.icon ?? ""} ${parent.name}`.trim() },
        ...children.map((c) => ({ value: `cat:${c.id}`, label: `${c.icon ?? ""} ${categoryLabel(list, c.id)}`.trim() })),
      ]),
    })),
    { label: "Cuentas", title: "Cuentas", options: accounts.map((a) => ({ value: `acc:${a.id}`, label: a.name })) },
  ];

  return (
    <div className="ff-page">
      <div className="ff-pagehead">
        <div>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/app/fernance/accounts")} style={{ paddingInline: 0 }}>
            Cuentas
          </Button>
          <h1 className="ff-title">Categorías</h1>
          <p className="ff-subtitle">Las colombianas que trae FerFinance y las tuyas, las palabras que le enseñaste y lo de siempre.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormState({})}>
          Nueva categoría
        </Button>
      </div>

      {error && (
        <EmptyState title="No se pudieron cargar las categorías" action={<Button onClick={() => void load()}>Reintentar</Button>}>
          {error}
        </EmptyState>
      )}
      {!all && !error && <Skeleton active paragraph={{ rows: 8 }} />}

      {all && (
        <section className="ff-card" aria-label="Categorías">
          <Segmented
            aria-label="Tipo de categorías"
            value={kind}
            onChange={(v) => setKind(v as CategoryKind)}
            options={[
              { value: "EXPENSE", label: "Gastos" },
              { value: "INCOME", label: "Ingresos" },
            ]}
          />
          <div className="ff-catlist">
            {tree.map(({ parent, children }) => (
              <div key={parent.id} className="ff-catlist__group">
                <div className="ff-catrow">
                  <span className="ff-catrow__icon" aria-hidden="true">
                    {parent.icon ?? "•"}
                  </span>
                  <span className="ff-catrow__name">{parent.name}</span>
                  <span className="ff-actions">
                    <Button size="small" icon={<PlusOutlined />} onClick={() => setFormState({ parentId: parent.id })} aria-label={`Nueva subcategoría de ${parent.name}`} />
                    <Button size="small" icon={<EditOutlined />} onClick={() => setFormState({ category: parent })} aria-label={`Editar ${parent.name}`} />
                    <Button size="small" icon={<InboxOutlined />} onClick={() => void archive(parent)} aria-label={`Archivar ${parent.name}`} />
                  </span>
                </div>
                {children.map((c) => (
                  <div key={c.id} className="ff-catrow ff-catrow--child">
                    <span className="ff-catrow__icon" aria-hidden="true">
                      {c.icon ?? "•"}
                    </span>
                    <span className="ff-catrow__name">{c.name}</span>
                    <span className="ff-actions">
                      <Button size="small" icon={<EditOutlined />} onClick={() => setFormState({ category: c })} aria-label={`Editar ${c.name}`} />
                      <Button size="small" icon={<InboxOutlined />} onClick={() => void archive(c)} aria-label={`Archivar ${c.name}`} />
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {archived.length > 0 && (
            <div className="ff-catlist__archived">
              <h3 className="ff-section-title" style={{ fontSize: "0.95rem" }}>
                Archivadas
              </h3>
              <div className="ff-chips">
                {archived.map((c) => (
                  <button key={c.id} type="button" className="ff-pick" onClick={() => void restore(c)} aria-label={`Restaurar ${c.name}`}>
                    <UndoOutlined /> {c.icon} {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {keywords && (
        <section className="ff-card" aria-labelledby="ff-words-title">
          <h2 id="ff-words-title" className="ff-section-title">
            Palabras que le enseñaste
          </h2>
          <p className="ff-hint">
            Cuando escribes como hablas («corrientazo 14 lucas»), FerFinance usa estas palabras primero. También puedes enseñarlas
            desde la hoja de Anotar cuando no entiende algo.
          </p>
          {keywords.length > 0 && (
            <div className="ff-list">
              {keywords.map((k) => (
                <div key={k.id} className="ff-row ff-row--compact">
                  <span className="ff-row__main">
                    <span className="ff-row__title">«{k.keyword}»</span>
                    <span className="ff-row__meta">
                      es {k.categoryName ? `${k.categoryIcon ?? ""} ${k.categoryName}` : `la cuenta ${k.accountName ?? ""}`}
                    </span>
                  </span>
                  <Button
                    size="small"
                    icon={<DeleteOutlined />}
                    aria-label={`Olvidar «${k.keyword}»`}
                    onClick={() =>
                      void deleteKeyword(k.id)
                        .then(async () => setKeywords(await fetchKeywords()))
                        .catch((err: unknown) => message.error(apiErrorMessage(err, "No se pudo borrar")))
                    }
                  />
                </div>
              ))}
            </div>
          )}
          <div className="ff-teach">
            <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Palabra: corrientazo, bancol…" maxLength={60} aria-label="Palabra" />
            <Select
              showSearch
              optionFilterProp="label"
              value={target}
              onChange={setTarget}
              placeholder="Es…"
              options={targetOptions}
              aria-label="A qué lleva la palabra"
              style={{ minWidth: 200 }}
              popupMatchSelectWidth={false}
            />
            <Button type="primary" disabled={!word.trim() || !target} onClick={() => void teach()}>
              Enseñar
            </Button>
          </div>
        </section>
      )}

      {shortcuts && (
        <section className="ff-card" aria-labelledby="ff-shortcuts-title">
          <h2 id="ff-shortcuts-title" className="ff-section-title">
            Lo de siempre
          </h2>
          <p className="ff-hint">
            Lo que anotas con un toque desde la hoja de Anotar: el tinto, el almuerzo, el bus. Se agregan con 📌 en las sugerencias o
            con «Guardar como lo de siempre» al editar un movimiento.
          </p>
          {shortcuts.length === 0 ? (
            <p className="ff-hint">Todavía no tienes. Cuando algo se repite tres veces, FerFinance te lo sugiere.</p>
          ) : (
            <div className="ff-list">
              {shortcuts.map((s) => (
                <div key={s.id} className="ff-row ff-row--compact">
                  <span className="ff-row__main">
                    <span className="ff-row__title">
                      {s.icon ?? "⭐"} {s.label}
                    </span>
                    <span className="ff-row__meta">
                      {formatCop(s.amount)} · {accounts.find((a) => a.id === s.accountId)?.name ?? "Cuenta"}
                      {s.categoryId ? ` · ${categoryLabel(list, s.categoryId)}` : ""}
                    </span>
                  </span>
                  <span className="ff-actions">
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      aria-label={`Editar ${s.label}`}
                      onClick={() => {
                        setEditing(s);
                        shortcutForm.setFieldsValue({ label: s.label, amount: s.amount, icon: s.icon ?? "" });
                      }}
                    />
                    <Button
                      size="small"
                      icon={<DeleteOutlined />}
                      aria-label={`Borrar ${s.label}`}
                      onClick={() =>
                        void deleteShortcut(s.id)
                          .then(async () => setShortcuts((await fetchQuick()).shortcuts))
                          .catch((err: unknown) => message.error(apiErrorMessage(err, "No se pudo borrar")))
                      }
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <CategoryFormModal
        open={formState !== null}
        kind={formState?.category?.kind ?? kind}
        category={formState?.category ?? null}
        parentId={formState?.parentId ?? null}
        categories={list}
        onClose={() => setFormState(null)}
        onDone={() => void refresh()}
      />

      <Modal
        open={editing !== null}
        title="Editar «lo de siempre»"
        okText="Guardar"
        cancelText="Cancelar"
        onOk={() => void saveShortcut()}
        onCancel={() => setEditing(null)}
        forceRender
      >
        <Form form={shortcutForm} layout="vertical" requiredMark={false}>
          <Form.Item name="label" label="Nombre" rules={[{ required: true, whitespace: true, message: "Ponle un nombre" }]}>
            <Input maxLength={40} />
          </Form.Item>
          <Form.Item name="amount" label="Monto" rules={[{ required: true, message: "Escribe el monto" }]}>
            <MoneyInput />
          </Form.Item>
          <Form.Item name="icon" label="Ícono (un emoji)">
            <Input maxLength={16} style={{ maxWidth: 120 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
