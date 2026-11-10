import { App, Form, Input, Modal, Select } from "antd";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { createCategory, updateCategory } from "../api";
import type { CategoryKind, FinanceCategory } from "../types";

const EMOJIS = ["🛒", "🍽️", "☕", "🛵", "🚌", "⛽", "💡", "🏠", "🩺", "💊", "🎉", "👕", "🎓", "🐶", "🎁", "✈️", "💼", "📦", "💰", "📈"];

type Props = {
  open: boolean;
  kind: CategoryKind;
  /** Con categoría: editarla. Sin ella: una nueva (con `parentId`, como subcategoría). */
  category?: FinanceCategory | null;
  parentId?: string | null;
  /** Todas (para elegir la principal). */
  categories: FinanceCategory[];
  onClose: () => void;
  onDone: () => void;
};

type Values = { name: string; icon?: string; parentId?: string | null };

export function CategoryFormModal({ open, kind, category, parentId, categories, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const icon = Form.useWatch("icon", form);
  const hasChildren = Boolean(category && categories.some((c) => c.parentId === category.id && !c.archivedAt));
  const parents = categories.filter((c) => c.kind === kind && !c.parentId && !c.archivedAt && c.id !== category?.id);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      category
        ? { name: category.name, icon: category.icon ?? "", parentId: category.parentId }
        : { parentId: parentId ?? null, icon: parentId ? (categories.find((c) => c.id === parentId)?.icon ?? "") : "" },
    );
  }, [open, category, parentId, categories, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (category) {
        await updateCategory(category.id, { name: v.name.trim(), icon: (v.icon ?? "").trim(), parentId: v.parentId ?? null });
      } else {
        await createCategory({
          name: v.name.trim(),
          kind,
          ...(v.parentId ? { parentId: v.parentId } : {}),
          ...(v.icon?.trim() ? { icon: v.icon.trim() } : {}),
        });
      }
      message.success(category ? "Categoría actualizada" : "Categoría creada");
      onDone();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar la categoría"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={category ? "Editar categoría" : parentId ? "Nueva subcategoría" : "Nueva categoría"}
      okText="Guardar"
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="name" label="Nombre" rules={[{ required: true, whitespace: true, message: "Ponle un nombre" }]}>
          <Input placeholder={kind === "INCOME" ? "Arriendos que cobro, freelance…" : "Corrientazo, peluquería, el gato…"} maxLength={60} autoFocus />
        </Form.Item>
        <Form.Item name="icon" label="Ícono" extra="Un emoji. Toca uno o escribe el tuyo.">
          <Input maxLength={16} style={{ maxWidth: 120 }} placeholder="😀" />
        </Form.Item>
        <div className="ff-chips" style={{ marginTop: -8, marginBottom: 16 }} role="group" aria-label="Íconos">
          {EMOJIS.map((e) => (
            <button key={e} type="button" className="ff-pick ff-pick--emoji" aria-pressed={icon === e} onClick={() => form.setFieldValue("icon", e)} aria-label={`Ícono ${e}`}>
              {e}
            </button>
          ))}
        </div>
        <Form.Item
          name="parentId"
          label="Dentro de"
          extra={hasChildren ? "Tiene subcategorías, así que se queda como principal." : "Déjala vacía para que sea una categoría principal."}
        >
          <Select
            allowClear
            disabled={hasChildren}
            placeholder="Es una categoría principal"
            options={parents.map((p) => ({ value: p.id, label: `${p.icon ?? ""} ${p.name}`.trim() }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
