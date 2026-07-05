import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import {
  createIncome,
  deleteIncome,
  fetchFinanceAccounts,
  fetchIncomes,
  updateIncome,
} from "../../../api/client";
import type { FinanceAccount, Income } from "../../../types/fernance";
import { formatCalendarDate } from "../../../utils/dates";
import { AccountSelector } from "../components/AccountSelector";
import { MonthRangePicker } from "../components/MonthRangePicker";
import { MoneyDisplay } from "../components/MoneyDisplay";
import { useFinanceContext } from "../context/FinanceContext";

export function IncomesPage() {
  const { accountId, bounds } = useFinanceContext();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    void Promise.all([
      fetchIncomes({ accountId: accountId ?? undefined, from: bounds.from, to: bounds.to }),
      fetchFinanceAccounts(),
    ])
      .then(([inc, acc]) => {
        setIncomes(inc);
        setAccounts(acc);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [accountId, bounds.from, bounds.to]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      date: dayjs(),
      accountId: accountId ?? accounts[0]?.id,
    });
    setOpen(true);
  };

  const openEdit = (row: Income) => {
    setEditing(row);
    form.setFieldsValue({
      ...row,
      date: dayjs(row.date),
    });
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      accountId: values.accountId,
      amount: values.amount,
      date: (values.date as dayjs.Dayjs).format("YYYY-MM-DD"),
      description: values.description,
    };
    try {
      if (editing) {
        await updateIncome(editing.id, payload);
        message.success("Ingreso actualizado");
      } else {
        await createIncome(payload);
        message.success("Ingreso registrado");
      }
      setOpen(false);
      load();
    } catch {
      message.error("No se pudo guardar");
    }
  };

  return (
    <div>
      <div className="fern-page-toolbar">
        <AccountSelector />
        <MonthRangePicker />
        <Button type="primary" onClick={openCreate}>
          Registrar ingreso
        </Button>
      </div>

      <Table
        loading={loading}
        rowKey="id"
        dataSource={incomes}
        columns={[
          { title: "Fecha", dataIndex: "date", render: (d: string) => formatCalendarDate(d) },
          { title: "Cuenta", dataIndex: ["account", "name"], render: (_: unknown, r: Income) => r.account?.name ?? "—" },
          { title: "Descripcion", dataIndex: "description", render: (d: string | null) => d || "Ingreso" },
          {
            title: "Monto",
            dataIndex: "amount",
            align: "right" as const,
            render: (v: number) => <MoneyDisplay amount={v} className="fern-money-positive" />,
          },
          {
            title: "",
            render: (_: unknown, row: Income) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>Editar</Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    Modal.confirm({
                      title: "Eliminar ingreso",
                      onOk: async () => {
                        await deleteIncome(row.id);
                        message.success("Eliminado");
                        load();
                      },
                    });
                  }}
                >
                  Eliminar
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal title={editing ? "Editar ingreso" : "Nuevo ingreso"} open={open} onCancel={() => setOpen(false)} onOk={() => void onSubmit()} okText="Guardar">
        <Form form={form} layout="vertical">
          <Form.Item name="accountId" label="Cuenta" rules={[{ required: true }]}>
            <Select options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
          </Form.Item>
          <Form.Item name="amount" label="Monto (COP)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} />
          </Form.Item>
          <Form.Item name="date" label="Fecha" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="description" label="Descripcion">
            <Input placeholder="Salario, venta, etc." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
