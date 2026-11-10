import { App, Button, DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { createIncome, deleteIncome, updateIncome } from "../api";
import { useFinanceContext } from "../context/FinanceContext";
import { formatCop } from "../money";
import type { Income } from "../types";
import { MoneyInput } from "./MoneyInput";

type Props = {
  open: boolean;
  /** Con ingreso: editarlo (o borrarlo). Sin ingreso: uno nuevo. */
  income?: Income | null;
  onClose: () => void;
  onDone: () => void;
};

type Values = { accountId: string; amount: number; date: Dayjs; description?: string };

export function IncomeFormModal({ open, income, onClose, onDone }: Props) {
  const { message, modal } = App.useApp();
  const { accounts, accountId } = useFinanceContext();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (income) {
      form.setFieldsValue({ accountId: income.accountId, amount: income.amount, date: dayjs(income.date), description: income.description ?? "" });
    } else {
      form.resetFields();
      form.setFieldsValue({ accountId: accountId ?? accounts[0]?.id, date: dayjs() });
    }
  }, [open, income, form, accountId, accounts]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const payload = { accountId: v.accountId, amount: v.amount, date: v.date.format("YYYY-MM-DD"), description: v.description?.trim() ?? "" };
      if (income) await updateIncome(income.id, payload);
      else await createIncome(payload);
      message.success(income ? "Ingreso actualizado" : `Ingreso de ${formatCop(v.amount)} anotado`);
      onDone();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar el ingreso"));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!income) return;
    modal.confirm({
      title: "¿Borrar este ingreso?",
      content: `${income.description || "Ingreso"} por ${formatCop(income.amount)}. No se puede deshacer.`,
      okText: "Borrar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteIncome(income.id);
          message.success("Ingreso borrado");
          onDone();
          onClose();
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo borrar"));
        }
      },
    });
  };

  const options = accounts.map((a) => ({ value: a.id, label: a.name }));
  if (income?.account && !accounts.some((a) => a.id === income.accountId)) options.unshift({ value: income.accountId, label: income.account.name });

  return (
    <Modal
      open={open}
      title={income ? "Editar ingreso" : "Nuevo ingreso"}
      onCancel={onClose}
      destroyOnHidden
      footer={[
        income ? (
          <Button key="del" danger onClick={remove} style={{ marginRight: "auto" }}>
            Borrar
          </Button>
        ) : null,
        <Button key="cancel" onClick={onClose}>
          Cancelar
        </Button>,
        <Button key="ok" type="primary" loading={saving} onClick={() => void submit()}>
          Guardar
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="amount" label="Monto" rules={[{ required: true, message: "Escribe el monto" }]}>
          <MoneyInput autoFocus />
        </Form.Item>
        <Form.Item name="accountId" label="Cuenta" rules={[{ required: true, message: "Elige la cuenta" }]}>
          <Select options={options} placeholder={options.length ? "Elige la cuenta" : "Primero crea una cuenta"} />
        </Form.Item>
        <Form.Item name="date" label="Fecha" rules={[{ required: true, message: "Elige la fecha" }]}>
          <DatePicker style={{ width: "100%" }} format="D MMM YYYY" allowClear={false} />
        </Form.Item>
        <Form.Item name="description" label="Descripción">
          <Input placeholder="Salario, venta, prima…" maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
