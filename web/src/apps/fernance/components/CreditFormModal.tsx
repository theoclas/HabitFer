import { App, DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { createCredit, updateCredit } from "../api";
import { useFinanceContext } from "../context/FinanceContext";
import { formatCop, previewInstallments } from "../money";
import type { Credit } from "../types";
import { longDate } from "./bits";
import { MoneyInput } from "./MoneyInput";

type Props = {
  open: boolean;
  /** Con crédito: editar nombre, cuenta y cuota de referencia. Sin crédito: crear uno nuevo. */
  credit?: Credit | null;
  onClose: () => void;
  onDone: (credit: Credit) => void;
};

type Values = { name: string; accountId: string; totalAmount?: number; installmentAmount: number; firstDueDate?: Dayjs };

export function CreditFormModal({ open, credit, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const { accounts, accountId } = useFinanceContext();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const editing = Boolean(credit);
  const total = Form.useWatch("totalAmount", form);
  const cuota = Form.useWatch("installmentAmount", form);
  const first = Form.useWatch("firstDueDate", form);
  const preview = !editing && total && cuota && first ? previewInstallments(total, cuota, first.format("YYYY-MM-DD")) : null;

  useEffect(() => {
    if (!open) return;
    if (credit) {
      form.setFieldsValue({ name: credit.name, accountId: credit.accountId, installmentAmount: credit.installmentAmount });
    } else {
      form.resetFields();
      form.setFieldsValue({ accountId: accountId ?? accounts[0]?.id, firstDueDate: dayjs().add(1, "month").date(1) });
    }
  }, [open, credit, form, accountId, accounts]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const saved = credit
        ? await updateCredit(credit.id, { name: v.name, accountId: v.accountId, installmentAmount: v.installmentAmount })
        : await createCredit({
            name: v.name,
            accountId: v.accountId,
            totalAmount: v.totalAmount ?? 0,
            installmentAmount: v.installmentAmount,
            firstDueDate: (v.firstDueDate ?? dayjs()).format("YYYY-MM-DD"),
          });
      message.success(credit ? "Crédito actualizado" : "Crédito creado con sus cuotas");
      onDone(saved);
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar el crédito"));
    } finally {
      setSaving(false);
    }
  };

  const options = accounts.map((a) => ({ value: a.id, label: a.name }));
  if (credit && !accounts.some((a) => a.id === credit.accountId)) options.unshift({ value: credit.accountId, label: credit.account.name });

  return (
    <Modal
      open={open}
      title={editing ? "Editar crédito" : "Nuevo crédito"}
      okText={editing ? "Guardar" : "Crear"}
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="name" label="Nombre" rules={[{ required: true, whitespace: true, message: "Ponle un nombre" }]}>
          <Input placeholder="Moto, tarjeta Nu, préstamo del banco…" maxLength={120} />
        </Form.Item>
        <Form.Item name="accountId" label="Cuenta" rules={[{ required: true, message: "Elige la cuenta" }]}>
          <Select options={options} placeholder={options.length ? "Elige la cuenta" : "Primero crea una cuenta"} />
        </Form.Item>
        {!editing && (
          <Form.Item
            name="totalAmount"
            label="Valor total a pagar"
            extra="Si el banco cobra intereses, pon la suma de todas las cuotas (cuota × número de cuotas)."
            rules={[{ required: true, message: "Escribe el valor total" }]}
          >
            <MoneyInput />
          </Form.Item>
        )}
        <Form.Item
          name="installmentAmount"
          label={editing ? "Cuota de referencia" : "Valor de cada cuota"}
          extra={editing ? "Para cambiar las cuotas que faltan usa «Rehacer cuotas»." : undefined}
          rules={[{ required: true, message: "Escribe el valor de la cuota" }]}
        >
          <MoneyInput />
        </Form.Item>
        {!editing && (
          <Form.Item name="firstDueDate" label="Primera cuota" rules={[{ required: true, message: "Elige la fecha" }]}>
            <DatePicker style={{ width: "100%" }} format="D MMM YYYY" allowClear={false} />
          </Form.Item>
        )}
      </Form>
      {preview && (
        <p className="ff-preview" role="status">
          {preview.count === 1
            ? `Una sola cuota de ${formatCop(total ?? 0)}, el ${longDate(preview.lastKey)}.`
            : preview.last === Math.round(cuota ?? 0)
              ? `Quedan ${preview.count} cuotas de ${formatCop(cuota ?? 0)}; la última el ${longDate(preview.lastKey)}.`
              : `Quedan ${preview.count} cuotas: ${preview.count - 1} de ${formatCop(cuota ?? 0)} y la última de ${formatCop(preview.last)}, el ${longDate(preview.lastKey)}.`}
        </p>
      )}
      {!editing && total && cuota && cuota > total ? (
        <p className="ff-preview ff-error" role="status">
          La cuota no puede ser mayor que el total.
        </p>
      ) : null}
    </Modal>
  );
}
