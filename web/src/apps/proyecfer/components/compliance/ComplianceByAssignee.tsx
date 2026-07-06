import { TeamOutlined } from "@ant-design/icons";
import { Card, Empty } from "antd";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ComplianceReport } from "../../../../types/proyecfer";

type Props = { report: ComplianceReport };

export function ComplianceByAssignee({ report }: Props) {
  const data = report.byAssignee.map((a) => ({
    name: a.assigneeName,
    rate: a.rate,
    completed: a.completedDays,
    expected: a.expectedDays,
  }));

  if (data.length === 0) {
    return null;
  }

  return (
    <Card
      className="panel-card compliance-chart-card"
      title={
        <>
          <TeamOutlined style={{ color: "#6366f1", marginRight: 8 }} />
          Cumplimiento por persona
        </>
      }
    >
      {data.every((d) => d.expected === 0) ? (
        <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8" }} unit="%" />
            <YAxis type="category" dataKey="name" width={100} tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#1e1e2a", border: "1px solid #334155" }}
              formatter={(value, _n, item) => [
                `${value ?? 0}% (${(item?.payload as { completed?: number })?.completed ?? 0}/${(item?.payload as { expected?: number })?.expected ?? 0})`,
                "Cumplimiento",
              ]}
            />
            <Bar dataKey="rate" fill="#6366f1" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
