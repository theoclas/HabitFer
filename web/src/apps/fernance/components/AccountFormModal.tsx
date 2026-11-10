import { App, Form, Input, Modal, Segmented } from "antd";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { createFinanceAccount, updateFinanceAccount } from "../api";
import { ACCOUNT_TYPE_LABELS, type FinanceAccount, type FinanceAccountType } from "../types";

const COLORS = ["#D4AF37", "#0D6E4C", "#2F7FB5", "#A64A22", "#8E4FB0", "#C2185B", "#5A6860"];

type Props = {
  open: boolean;
  account?: FinanceAccount | null;
  onClose: () => void;
  onDone: () => void;
};

type Values = { name: string; type: FinanceAccountType; color: string };

export function AccountFormModal({ open, account, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const color = Form.useWatch("color", form);

  useEffect(() => {
    if (!open) return;
    if (account) form.setFieldsValue({ name: account.name, type: account.type, color: account.color ?? COLORS[0] });
    else {
      form.resetFields();
      form.setFieldsValue({ type: "PERSONAL", color: COLORS[0] });
    }
  }, [open, account, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (account) await updateFinanceAccount(account.id, v);
      else await createFinanceAccount(v);
      message.success(account ? "Cuenta actualizada" : "Cuenta creada");
      onDone();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar la cuenta"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={account ? "Editar cuenta" : "Nueva cuenta"}
      okText="Guardar"
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="name" label="Nombre" rules={[{ required: true, whitespace: true, message: "Ponle un nombre" }]}>
          <Input placeholder="Personal, Negocio, Bancolombia…" maxLength={120} autoFocus />
        </Form.Item>
        <Form.Item name="type" label="Es de">
          <Segmented block options={(Object.keys(ACCOUNT_TYPE_LABELS) as FinanceAccountType[]).map((k) => ({ value: k, label: ACCOUNT_TYPE_LABELS[k] }))} />
        </Form.Item>
        <Form.Item name="color" label="Color">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label="Color de la cuenta">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Color ${c}`}
                onClick={() => form.setFieldValue("color", c)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: c,
                  cursor: "pointer",
                  border: color === c ? "3px solid var(--ff-ink)" : "3px solid transparent",
                  boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.35)",
                }}
              />
            ))}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
