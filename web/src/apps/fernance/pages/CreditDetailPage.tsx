import { Button, Card, Space, Spin, Table, Tag, Typography, message } from "antd";
import { ArrowLeftOutlined, CheckOutlined, UndoOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCredit, payInstallment, unpayInstallment } from "../../../api/client";
import type { Credit, CreditInstallment } from "../../../types/fernance";
import { formatCalendarDate } from "../../../utils/dates";
import { MoneyDisplay } from "../components/MoneyDisplay";

const BASE = "/app/fernance";

export function CreditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [credit, setCredit] = useState<Credit | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!id) return;
    setLoading(true);
    void fetchCredit(id)
      .then(setCredit)
      .catch(() => setCredit(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const togglePay = async (row: CreditInstallment) => {
    try {
      if (row.status === "PAID") {
        await unpayInstallment(row.id);
        message.success("Pago revertido");
      } else {
        await payInstallment(row.id);
        message.success("Cuota marcada como pagada");
      }
      load();
    } catch {
      message.error("No se pudo actualizar la cuota");
    }
  };

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!credit) {
    return <Typography.Text type="danger">Credito no encontrado</Typography.Text>;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link to={`${BASE}/credits`}>
          <Button icon={<ArrowLeftOutlined />}>Volver</Button>
        </Link>
      </Space>

      <Card style={{ marginBottom: 20, borderColor: "rgba(212,175,55,0.3)" }}>
        <Typography.Title level={4} style={{ margin: 0, color: "#F5C542" }}>
          {credit.name}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          {credit.account?.name} — Total <MoneyDisplay amount={credit.totalAmount} /> — Cuota{" "}
          <MoneyDisplay amount={credit.installmentAmount} />
        </Typography.Paragraph>
        <Tag color="gold">{credit.status}</Tag>
      </Card>

      <Typography.Title level={5} style={{ color: "#F5C542" }}>
        Cuotas
      </Typography.Title>
      <Table
        rowKey="id"
        dataSource={credit.installments ?? []}
        pagination={{ pageSize: 12, hideOnSinglePage: true }}
        columns={[
          { title: "Vencimiento", dataIndex: "dueDate", render: (d: string) => formatCalendarDate(d) },
          {
            title: "Monto",
            dataIndex: "amount",
            render: (v: number) => <MoneyDisplay amount={v} />,
          },
          {
            title: "Estado",
            dataIndex: "status",
            render: (s: string) => (
              <Tag color={s === "PAID" ? "green" : "orange"}>{s === "PAID" ? "Pagada" : "Pendiente"}</Tag>
            ),
          },
          {
            title: "Pagada el",
            dataIndex: "paidAt",
            render: (d: string | null) => (d ? formatCalendarDate(d.slice(0, 10)) : "—"),
          },
          {
            title: "",
            render: (_: unknown, row: CreditInstallment) => (
              <Button
                size="small"
                type={row.status === "PAID" ? "default" : "primary"}
                icon={row.status === "PAID" ? <UndoOutlined /> : <CheckOutlined />}
                onClick={() => void togglePay(row)}
              >
                {row.status === "PAID" ? "Revertir" : "Marcar pagada"}
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
