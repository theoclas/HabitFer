import { App, DatePicker, Form, Modal, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { payInstallment } from "../api";
import { useFinanceContext } from "../context/FinanceContext";
import { formatCop } from "../money";
import type { Credit } from "../types";
import { longDate } from "./bits";
import { MoneyInput } from "./MoneyInput";

export type PayTarget = {
  id: string;
  creditName: string;
  dueDate: string;
  amount: number;
  /** Cuenta del crédito (la que se propone). */
  accountId: string;
  /** Si ya estaba pagada: los datos del pago, para cambiarlos. */
  paidDate?: string | null;
  paidAmount?: number | null;
  paidAccountId?: string | null;
};

type Props = {
  target: PayTarget | null;
  onClose: () => void;
  onDone: (credit: Credit) => void;
};

type Values = { paidDate: Dayjs; paidAmount: number; accountId: string };

/** Marcar una cuota pagada (o cambiar el pago) con el día, el valor y la cuenta de verdad. */
export function PayInstallmentModal({ target, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const { accounts } = useFinanceContext();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const editing = Boolean(target?.paidDate);

  useEffect(() => {
    if (!target) return;
    form.setFieldsValue({
      paidDate: dayjs(target.paidDate ?? undefined),
      paidAmount: target.paidAmount ?? target.amount,
      accountId: target.paidAccountId ?? target.accountId,
    });
  }, [target, form]);

  const submit = async () => {
    if (!target) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const credit = await payInstallment(target.id, {
        paidDate: values.paidDate.format("YYYY-MM-DD"),
        paidAmount: values.paidAmount,
        accountId: values.accountId,
      });
      message.success(editing ? "Pago actualizado" : `Cuota de ${target.creditName} pagada`);
      onDone(credit);
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar el pago"));
    } finally {
      setSaving(false);
    }
  };

  // La cuenta del crédito sale aunque esté archivada, para no perder el dato.
  const options = accounts.map((a) => ({ value: a.id, label: a.name }));
  if (target && !accounts.some((a) => a.id === target.accountId)) options.unshift({ value: target.accountId, label: "Cuenta del crédito" });

  return (
    <Modal
      open={Boolean(target)}
      title={editing ? "Cambiar el pago" : "Marcar la cuota pagada"}
      okText={editing ? "Guardar" : "Marcar pagada"}
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {target && (
        <p className="ff-hint" style={{ marginBottom: 14 }}>
          {target.creditName}: cuota de {formatCop(target.amount)} que vence el {longDate(target.dueDate)}.
        </p>
      )}
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="paidDate" label="Día en que pagaste" rules={[{ required: true, message: "Elige el día" }]}>
          <DatePicker
            style={{ width: "100%" }}
            format="D MMM YYYY"
            allowClear={false}
            disabledDate={(d) => d.isAfter(dayjs().add(1, "day"), "day")}
          />
        </Form.Item>
        <Form.Item
          name="paidAmount"
          label="Lo que pagaste"
          extra="Si pagaste más o menos que la cuota, pon el valor real."
          rules={[{ required: true, message: "Escribe el valor" }]}
        >
          <MoneyInput />
        </Form.Item>
        <Form.Item name="accountId" label="Salió de la cuenta" rules={[{ required: true, message: "Elige la cuenta" }]}>
          <Select options={options} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
