import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Table, Tag, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createCredit, fetchCredits, fetchFinanceAccounts } from "../../../api/client";
import type { Credit, FinanceAccount } from "../../../types/fernance";
import { MoneyDisplay } from "../components/MoneyDisplay";
import { AccountSelector } from "../components/AccountSelector";
import { useFinanceContext } from "../context/FinanceContext";

const BASE = "/app/fernance";

export function CreditsPage() {
  const { accountId } = useFinanceContext();
  const [credits, setCredits] = useState<Credit[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    void Promise.all([
      fetchCredits({ accountId: accountId ?? undefined, status: "ACTIVE" }),
      fetchFinanceAccounts(),
    ])
      .then(([c, a]) => {
        setCredits(c);
        setAccounts(a);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [accountId]);

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      await createCredit({
        accountId: values.accountId,
        name: values.name,
        totalAmount: values.totalAmount,
        installmentAmount: values.installmentAmount,
        firstDueDate: (values.firstDueDate as dayjs.Dayjs).format("YYYY-MM-DD"),
      });
      message.success("Credito creado con cuotas");
      setOpen(false);
      form.resetFields();
      load();
    } catch {
      message.error("No se pudo crear el credito");
    }
  };

  return (
    <div>
      <div className="fern-page-toolbar">
        <AccountSelector />
        <Button
          type="primary"
          onClick={() => {
            form.resetFields();
            form.setFieldsValue({
              accountId: accountId ?? accounts[0]?.id,
              firstDueDate: dayjs().add(1, "month").date(1),
            });
            setOpen(true);
          }}
        >
          Nuevo credito
        </Button>
      </div>

      <Table
        loading={loading}
        rowKey="id"
        dataSource={credits}
        columns={[
          {
            title: "Nombre",
            dataIndex: "name",
            render: (name: string, row: Credit) => (
              <Link to={`${BASE}/credits/${row.id}`} style={{ color: "#F5C542" }}>
                {name}
              </Link>
            ),
          },
          { title: "Cuenta", render: (_: unknown, r: Credit) => r.account?.name ?? "—" },
          { title: "Total", dataIndex: "totalAmount", render: (v: number) => <MoneyDisplay amount={v} /> },
          { title: "Cuota", dataIndex: "installmentAmount", render: (v: number) => <MoneyDisplay amount={v} /> },
          {
            title: "Cuotas",
            render: (_: unknown, r: Credit) => {
              const total = r.installments?.length ?? 0;
              const paid = r.installments?.filter((i) => i.status === "PAID").length ?? 0;
              return `${paid}/${total}`;
            },
          },
          {
            title: "Estado",
            dataIndex: "status",
            render: (s: string) => <Tag color={s === "ACTIVE" ? "gold" : "default"}>{s}</Tag>,
          },
        ]}
      />

      <Modal title="Nuevo credito" open={open} onCancel={() => setOpen(false)} onOk={() => void onSubmit()} okText="Crear">
        <Form form={form} layout="vertical">
          <Form.Item name="accountId" label="Cuenta" rules={[{ required: true }]}>
            <Select options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
          </Form.Item>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Tarjeta, prestamo..." />
          </Form.Item>
          <Form.Item name="totalAmount" label="Valor total" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="installmentAmount" label="Valor cuota" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="firstDueDate" label="Primera cuota" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
