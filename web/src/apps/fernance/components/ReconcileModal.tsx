import { App, DatePicker, Form, Modal } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { todayKey } from "../../../utils/dates";
import { apiErrorMessage } from "../../habitfer/format";
import { reconcileAccount } from "../api";
import { formatCop, formatCopSigned } from "../money";
import type { FinanceAccount } from "../types";
import { MoneyInput } from "./MoneyInput";

type Props = {
  account: FinanceAccount | null;
  onClose: () => void;
  onDone: () => void;
};

/** Cuadrar con el banco: escribes el saldo que dice la app del banco y FerFinance crea el ajuste que falte. */
export function ReconcileModal({ account, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const today = todayKey();
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const isCard = account?.kind === "CREDIT_CARD";

  useEffect(() => {
    if (!account) return;
    setValue(null);
    setDate(todayKey());
  }, [account]);

  const current = account?.balance ?? 0;
  const bank = value === null ? null : isCard ? -value : value;
  const diff = bank === null ? null : Math.round(bank - current);

  const submit = async () => {
    if (!account || bank === null) return;
    setSaving(true);
    try {
      const r = await reconcileAccount(account.id, bank, date === today ? undefined : date);
      message.success(
        r.adjustment === 0
          ? `«${account.name}» ya cuadraba con el banco`
          : `«${account.name}» cuadrada: se anotó un ajuste de ${formatCopSigned(r.adjustment)}`,
        5,
      );
      onDone();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo cuadrar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={account !== null}
      title={account ? `Cuadrar ${account.name}` : "Cuadrar"}
      okText="Cuadrar"
      cancelText="Cancelar"
      okButtonProps={{ disabled: value === null }}
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <p className="ff-hint" style={{ marginTop: 0 }}>
        Abre la app del banco y escribe el saldo que te muestra. FerFinance anota la diferencia como un ajuste y marca
        «revisado hasta aquí».
      </p>
      <Form layout="vertical" requiredMark={false}>
        <Form.Item label={isCard ? "Lo que debes según el banco" : "Saldo que dice el banco"}>
          <MoneyInput
            min={0}
            autoFocus
            value={value ?? undefined}
            onChange={(v) => setValue(v === null || v === undefined ? null : Math.round(Number(v)))}
            aria-label={isCard ? "Lo que debes según el banco" : "Saldo que dice el banco"}
          />
        </Form.Item>
        <Form.Item label="De qué día es ese saldo">
          <DatePicker
            style={{ width: "100%" }}
            value={dayjs(date)}
            onChange={(d) => d && setDate(d.format("YYYY-MM-DD"))}
            format="D MMM YYYY"
            allowClear={false}
            disabledDate={(d) => d.isAfter(dayjs(today), "day")}
          />
        </Form.Item>
      </Form>
      {account && (
        <p className="ff-preview">
          Hoy FerFinance dice {formatCop(isCard ? -current : current)}
          {isCard ? " de deuda" : ""}.
          {date === today && diff !== null && (
            <>
              {" "}
              {diff === 0 ? "Ya cuadra: no hay que ajustar nada." : `Se anotará un ajuste de ${formatCopSigned(diff)}.`}
            </>
          )}
        </p>
      )}
    </Modal>
  );
}
