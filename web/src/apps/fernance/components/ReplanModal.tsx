import { App, DatePicker, Form, InputNumber, Modal } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { replanCredit } from "../api";
import { addMonthsKey, formatCop } from "../money";
import type { Credit } from "../types";
import { longDate } from "./bits";
import { MoneyInput } from "./MoneyInput";

type Props = {
  credit: Credit | null;
  open: boolean;
  onClose: () => void;
  onDone: (credit: Credit) => void;
};

type Values = { count: number; amount: number; firstDueDate: Dayjs; lastAmount?: number | null };

/** Rehacer las cuotas que faltan (las pagadas se quedan como están). */
export function ReplanModal({ credit, open, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const count = Form.useWatch("count", form);
  const amount = Form.useWatch("amount", form);
  const first = Form.useWatch("firstDueDate", form);
  const lastAmount = Form.useWatch("lastAmount", form);

  useEffect(() => {
    if (!open || !credit) return;
    form.setFieldsValue({
      count: Math.max(1, credit.pendingCount),
      amount: credit.installmentAmount,
      firstDueDate: dayjs(credit.nextDue?.dueDate ?? undefined),
      lastAmount: null,
    });
  }, [open, credit, form]);

  const n = typeof count === "number" && count >= 1 ? Math.trunc(count) : 0;
  const summary =
    n && amount && first
      ? {
          lastKey: addMonthsKey(first.format("YYYY-MM-DD"), n - 1),
          total: amount * (n - 1) + (lastAmount ?? amount),
        }
      : null;

  const submit = async () => {
    if (!credit) return;
    const v = await form.validateFields();
    setSaving(true);
    try {
      const saved = await replanCredit(credit.id, {
        count: Math.trunc(v.count),
        amount: v.amount,
        firstDueDate: v.firstDueDate.format("YYYY-MM-DD"),
        ...(v.lastAmount ? { lastAmount: v.lastAmount } : {}),
      });
      message.success("Cuotas rehechas");
      onDone(saved);
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudieron rehacer las cuotas"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Rehacer las cuotas que faltan"
      okText="Rehacer"
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <p className="ff-hint" style={{ marginBottom: 14 }}>
        Las {credit?.paidCount ?? 0} cuotas pagadas no cambian. Las pendientes se reemplazan por este plan.
      </p>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="count" label="Cuántas cuotas faltan" rules={[{ required: true, message: "Escribe cuántas" }]}>
          <InputNumber min={1} max={600} precision={0} style={{ width: "100%" }} inputMode="numeric" />
        </Form.Item>
        <Form.Item name="amount" label="Valor de cada cuota" rules={[{ required: true, message: "Escribe el valor" }]}>
          <MoneyInput />
        </Form.Item>
        <Form.Item name="firstDueDate" label="Próxima cuota" rules={[{ required: true, message: "Elige la fecha" }]}>
          <DatePicker style={{ width: "100%" }} format="D MMM YYYY" allowClear={false} />
        </Form.Item>
        <Form.Item name="lastAmount" label="Última cuota (si es distinta)">
          <MoneyInput placeholder="Igual a las demás" />
        </Form.Item>
      </Form>
      {summary && (
        <p className="ff-preview" role="status">
          {n === 1 ? "Una cuota" : `${n} cuotas`} hasta el {longDate(summary.lastKey)}: faltarían {formatCop(summary.total)}.
        </p>
      )}
    </Modal>
  );
}
