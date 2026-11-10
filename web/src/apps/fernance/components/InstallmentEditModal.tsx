import { App, DatePicker, Form, Modal } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { updateInstallment } from "../api";
import type { Credit, CreditInstallment } from "../types";
import { MoneyInput } from "./MoneyInput";

type Props = {
  installment: CreditInstallment | null;
  onClose: () => void;
  onDone: (credit: Credit) => void;
};

type Values = { dueDate: Dayjs; amount: number };

/** Cambiar la fecha o el valor de una cuota pendiente. */
export function InstallmentEditModal({ installment, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (installment) form.setFieldsValue({ dueDate: dayjs(installment.dueDate), amount: installment.amount });
  }, [installment, form]);

  const submit = async () => {
    if (!installment) return;
    const v = await form.validateFields();
    setSaving(true);
    try {
      const credit = await updateInstallment(installment.id, { dueDate: v.dueDate.format("YYYY-MM-DD"), amount: v.amount });
      message.success("Cuota actualizada");
      onDone(credit);
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo cambiar la cuota"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(installment)}
      title="Cambiar la cuota"
      okText="Guardar"
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="dueDate" label="Vence el" rules={[{ required: true, message: "Elige la fecha" }]}>
          <DatePicker style={{ width: "100%" }} format="D MMM YYYY" allowClear={false} />
        </Form.Item>
        <Form.Item name="amount" label="Valor" rules={[{ required: true, message: "Escribe el valor" }]}>
          <MoneyInput />
        </Form.Item>
      </Form>
    </Modal>
  );
}
