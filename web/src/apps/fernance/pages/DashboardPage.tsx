import { Collapse, Spin, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { fetchFinanceSummary } from "../../../api/client";
import type { FinanceSummary } from "../../../types/fernance";
import { formatCalendarDate } from "../../../utils/dates";
import { AccountSelector } from "../components/AccountSelector";
import { MonthRangePicker } from "../components/MonthRangePicker";
import { MoneyDisplay } from "../components/MoneyDisplay";
import { SummaryCards } from "../components/SummaryCards";
import { useFinanceContext } from "../context/FinanceContext";

const movementTypeLabels: Record<string, string> = {
  income: "Ingreso",
  installment_paid: "Cuota pagada",
  installment_pending: "Cuota pendiente",
};

export function DashboardPage() {
  const { accountId, bounds } = useFinanceContext();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchFinanceSummary({
      accountId: accountId ?? undefined,
      from: bounds.from,
      to: bounds.to,
    })
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [accountId, bounds.from, bounds.to]);

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!summary) {
    return <Typography.Text type="danger">No se pudo cargar el resumen.</Typography.Text>;
  }

  return (
    <div>
      <div className="fern-page-toolbar">
        <AccountSelector />
        <MonthRangePicker />
      </div>

      <SummaryCards totals={summary.totals} />

      <Typography.Title level={5} style={{ marginBottom: 12, color: "#F5C542" }}>
        Movimientos del periodo
      </Typography.Title>
      <Table
        size="small"
        rowKey={(r) => `${r.type}-${r.id}`}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        dataSource={summary.movements}
        columns={[
          { title: "Fecha", dataIndex: "date", render: (d: string) => formatCalendarDate(d, "DD MMM") },
          {
            title: "Tipo",
            dataIndex: "type",
            render: (t: string) => (
              <Tag color={t === "income" ? "green" : t === "installment_paid" ? "gold" : "orange"}>
                {movementTypeLabels[t] ?? t}
              </Tag>
            ),
          },
          { title: "Descripcion", dataIndex: "label" },
          { title: "Cuenta", dataIndex: "accountName" },
          {
            title: "Monto",
            dataIndex: "amount",
            align: "right" as const,
            render: (v: number) => <MoneyDisplay amount={v} signed />,
          },
        ]}
      />

      {summary.projection.length > 0 && (
        <div className="fern-projection-panel" style={{ marginTop: 24, padding: 16 }}>
          <Collapse
            ghost
            items={[
              {
                key: "proj",
                label: (
                  <Typography.Text strong style={{ color: "#F5C542" }}>
                    Proyeccion — cuotas futuras
                  </Typography.Text>
                ),
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {summary.projection.map((block) => (
                      <div key={block.month}>
                        <Typography.Text strong style={{ textTransform: "capitalize" }}>
                          {formatCalendarDate(block.month + "-01", "MMMM YYYY")} —{" "}
                          <MoneyDisplay amount={block.total} />
                        </Typography.Text>
                        <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                          {block.installments.map((i) => (
                            <li key={i.id}>
                              {i.creditName} — {formatCalendarDate(i.dueDate, "DD MMM")} —{" "}
                              <MoneyDisplay amount={i.amount} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
