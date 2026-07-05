import { BarChartOutlined, PieChartOutlined } from "@ant-design/icons";
import { Card, Empty } from "antd";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProyecFerStats } from "../../../types/proyecfer";

type Props = { stats: ProyecFerStats };

const STATUS_COLORS = {
  TODO: "#64748b",
  IN_PROGRESS: "#fbbf24",
  DONE: "#34d399",
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "Pendiente",
  IN_PROGRESS: "En progreso",
  DONE: "Hecha",
};

export function WorkspaceCharts({ stats }: Props) {
  const assigneeData = Object.entries(stats.byAssignee).map(([name, count]) => ({ name, count }));

  const statusData = stats.byStatus
    ? Object.entries(stats.byStatus).map(([status, count]) => ({
        name: STATUS_LABELS[status] ?? status,
        value: count,
        color: STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "#818cf8",
      }))
    : [];

  const hasStatus = statusData.some((d) => d.value > 0);
  const hasAssignee = assigneeData.length > 0;

  if (!hasStatus && !hasAssignee) {
    return (
      <Card className="panel-card">
        <Empty description="Sin datos de tareas aun" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <div className="workspace-charts">
      {hasStatus && (
        <Card
          className="panel-card"
          title={
            <>
              <PieChartOutlined style={{ color: "#6366f1", marginRight: 8 }} />
              Tareas por estado
            </>
          }
        >
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={88}
                paddingAngle={3}
              >
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#16161f",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="workspace-chart-legend">
            {statusData.map((d) => (
              <span key={d.name} className="workspace-chart-legend__item">
                <span className="workspace-chart-legend__dot" style={{ background: d.color }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </Card>
      )}

      {hasAssignee && (
        <Card
          className="panel-card"
          title={
            <>
              <BarChartOutlined style={{ color: "#6366f1", marginRight: 8 }} />
              Tareas por miembro
            </>
          }
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={assigneeData} layout="vertical" margin={{ left: 8, right: 8 }}>
              <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#16161f",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="count" fill="url(#wsBarGradient)" radius={[0, 6, 6, 0]} />
              <defs>
                <linearGradient id="wsBarGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
