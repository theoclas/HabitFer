import { LineChartOutlined } from "@ant-design/icons";
import { Card, Empty } from "antd";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComplianceReport } from "../../../../types/proyecfer";
import { formatCalendarDate } from "../../../../utils/dates";

type Props = { report: ComplianceReport };

export function ComplianceTrendChart({ report }: Props) {
  const data = report.trend.map((p) => ({
    ...p,
    label: formatCalendarDate(p.date, "DD MMM"),
  }));

  if (!data.some((d) => d.expected > 0)) {
    return (
      <Card className="panel-card compliance-chart-card">
        <Empty description="Sin datos en el rango" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <Card
      className="panel-card compliance-chart-card"
      title={
        <>
          <LineChartOutlined style={{ color: "#6366f1", marginRight: 8 }} />
          Tendencia de cumplimiento
        </>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="complianceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
          <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
          <Tooltip
            contentStyle={{ background: "#1e1e2a", border: "1px solid #334155" }}
            formatter={(value) => [`${value ?? 0}%`, "Cumplimiento"]}
          />
          <Area type="monotone" dataKey="rate" stroke="#818cf8" fill="url(#complianceFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
