import { Button, Card, Form, Input, Modal, Select, Space, Table, message } from "antd";
import { useEffect, useState } from "react";
import { createFinanceAccount, deleteFinanceAccount, fetchFinanceAccounts, updateFinanceAccount } from "../../../api/client";
import type { FinanceAccount, FinanceAccountType } from "../../../types/fernance";
import { ACCOUNT_TYPE_LABELS } from "../../../types/fernance";

export function AccountsPage() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceAccount | null>(null);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    void fetchFinanceAccounts()
      .then(setAccounts)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ type: "PERSONAL", color: "#D4AF37" });
    setOpen(true);
  };

  const openEdit = (row: FinanceAccount) => {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateFinanceAccount(editing.id, values);
        message.success("Cuenta actualizada");
      } else {
        await createFinanceAccount(values);
        message.success("Cuenta creada");
      }
      setOpen(false);
      load();
    } catch {
      message.error("No se pudo guardar");
    }
  };

  const onDelete = (row: FinanceAccount) => {
    Modal.confirm({
      title: "Eliminar cuenta",
      content: `Se eliminaran ingresos y creditos de "${row.name}".`,
      okType: "danger",
      onOk: async () => {
        await deleteFinanceAccount(row.id);
        message.success("Cuenta eliminada");
        load();
      },
    });
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={openCreate}>
          Nueva cuenta
        </Button>
      </Space>
      <Card>
        <Table
          loading={loading}
          rowKey="id"
          dataSource={accounts}
          columns={[
            {
              title: "Nombre",
              dataIndex: "name",
              render: (name: string, row: FinanceAccount) => (
                <span>
                  <span className="fern-account-dot" style={{ background: row.color ?? "#D4AF37" }} />
                  {name}
                </span>
              ),
            },
            {
              title: "Tipo",
              dataIndex: "type",
              render: (t: FinanceAccountType) => ACCOUNT_TYPE_LABELS[t],
            },
            { title: "Moneda", dataIndex: "currency" },
            {
              title: "Acciones",
              render: (_: unknown, row: FinanceAccount) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(row)}>Editar</Button>
                  <Button size="small" danger onClick={() => onDelete(row)}>Eliminar</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? "Editar cuenta" : "Nueva cuenta"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void onSubmit()}
        okText="Guardar"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Finanzas personales" />
          </Form.Item>
          <Form.Item name="type" label="Tipo" rules={[{ required: true }]}>
            <Select
              options={(Object.keys(ACCOUNT_TYPE_LABELS) as FinanceAccountType[]).map((k) => ({
                value: k,
                label: ACCOUNT_TYPE_LABELS[k],
              }))}
            />
          </Form.Item>
          <Form.Item name="color" label="Color">
            <Input type="color" style={{ width: 80, height: 36, padding: 2 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
