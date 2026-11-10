import { App, AutoComplete, Form, Input, Modal, Segmented } from "antd";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { createFinanceAccount, updateFinanceAccount } from "../api";
import {
  ACCOUNT_KIND_ICONS,
  ACCOUNT_KIND_LABELS,
  ACCOUNT_TYPE_LABELS,
  INSTITUTIONS,
  type FinanceAccount,
  type FinanceAccountKind,
  type FinanceAccountType,
} from "../types";
import { MoneyInput } from "./MoneyInput";

const COLORS = ["#D4AF37", "#0D6E4C", "#2F7FB5", "#A64A22", "#8E4FB0", "#C2185B", "#5A6860"];
const KINDS: FinanceAccountKind[] = ["SAVINGS", "WALLET", "CASH", "CREDIT_CARD", "CHECKING", "INVESTMENT", "OTHER"];

type Props = {
  open: boolean;
  account?: FinanceAccount | null;
  onClose: () => void;
  onDone: () => void;
};

type Values = {
  name: string;
  type: FinanceAccountType;
  kind: FinanceAccountKind;
  color: string;
  institution?: string;
  last4?: string;
  opening?: number;
};

export function AccountFormModal({ open, account, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const color = Form.useWatch("color", form);
  const kind = Form.useWatch("kind", form) as FinanceAccountKind | undefined;
  const isCard = kind === "CREDIT_CARD";
  const isCash = kind === "CASH";

  useEffect(() => {
    if (!open) return;
    if (account)
      form.setFieldsValue({
        name: account.name,
        type: account.type,
        kind: account.kind,
        color: account.color ?? COLORS[0],
        institution: account.institution ?? "",
        last4: account.last4 ?? "",
        opening: Math.abs(account.openingBalance) || undefined,
      });
    else {
      form.resetFields();
      form.setFieldsValue({ type: "PERSONAL", kind: "SAVINGS", color: COLORS[0] });
    }
  }, [open, account, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const opening = v.opening ? Math.round(v.opening) : 0;
      const payload = {
        name: v.name.trim(),
        type: v.type,
        kind: v.kind,
        color: v.color,
        institution: v.kind === "CASH" ? "" : (v.institution ?? "").trim(),
        last4: v.kind === "CASH" || v.kind === "OTHER" ? "" : (v.last4 ?? "").trim(),
        // En una tarjeta, lo que se debía al empezar es un saldo negativo.
        openingBalance: v.kind === "CREDIT_CARD" ? -opening : opening,
      };
      if (account) await updateFinanceAccount(account.id, payload);
      else await createFinanceAccount(payload);
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
        <Form.Item name="kind" label="¿Qué es?">
          <div className="ff-chips" role="radiogroup" aria-label="Tipo de cuenta">
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className="ff-pick" onClick={() => form.setFieldValue("kind", k)}>
                <span aria-hidden="true">{ACCOUNT_KIND_ICONS[k]}</span>
                {ACCOUNT_KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </Form.Item>
        {!isCash && (
          <Form.Item name="institution" label="Banco o entidad">
            <AutoComplete
              options={INSTITUTIONS.map((i) => ({ value: i }))}
              placeholder="Bancolombia, Nequi, Nu…"
              filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
              onSelect={(value: string) => {
                if (!form.getFieldValue("name")) form.setFieldValue("name", value);
              }}
              maxLength={60}
            />
          </Form.Item>
        )}
        <Form.Item name="name" label="Nombre" rules={[{ required: true, whitespace: true, message: "Ponle un nombre" }]}>
          <Input placeholder={isCash ? "Efectivo, billetera…" : "Bancolombia ahorros, Nequi, Tarjeta Nu…"} maxLength={120} />
        </Form.Item>
        <Form.Item name="type" label="Libro" extra="Personal y Negocio se llevan separados.">
          <Segmented block options={(Object.keys(ACCOUNT_TYPE_LABELS) as FinanceAccountType[]).map((k) => ({ value: k, label: ACCOUNT_TYPE_LABELS[k] }))} />
        </Form.Item>
        {!isCash && kind !== "OTHER" && (
          <Form.Item name="last4" label="Últimos 4 dígitos (opcional)" rules={[{ pattern: /^\d{4}$/, message: "Son cuatro números" }]}>
            <Input inputMode="numeric" maxLength={4} placeholder="1234" style={{ maxWidth: 140 }} />
          </Form.Item>
        )}
        <Form.Item
          name="opening"
          label={isCard ? "Lo que debías al empezar" : "Saldo al empezar"}
          extra={
            account
              ? "Cambiarlo mueve el saldo de hoy. Para corregir el saldo de hoy, mejor usa «Cuadrar»."
              : isCard
                ? "Lo que debías en la tarjeta antes de lo que anotes aquí. Después la cuadras con el banco."
                : "Lo que tenía antes de lo que anotes aquí. Después la puedes cuadrar con el banco."
          }
        >
          <MoneyInput min={0} placeholder="0" />
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
