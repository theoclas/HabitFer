import { BarChartOutlined } from "@ant-design/icons";
import { Card, Empty, Select, Typography } from "antd";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHero } from "../../../components/PageHero";
import { fetchProyecFerStats, fetchWorkspaces } from "../../../api/proyecfer";
import type { ProyecFerStats, WorkspaceSummary } from "../../../types/proyecfer";

export function ProyecFerStatsPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>();
  const [stats, setStats] = useState<ProyecFerStats | null>(null);

  useEffect(() => {
    void fetchWorkspaces().then((list) => {
      setWorkspaces(list);
      if (list[0]) setWorkspaceId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    void fetchProyecFerStats(workspaceId).then(setStats).catch(() => setStats(null));
  }, [workspaceId]);

  const chartData = stats
    ? Object.entries(stats.byAssignee).map(([name, count]) => ({ name, count }))
    : [];

  return (
    <div>
      <PageHero
        variant="proyec"
        title="Estadisticas"
        subtitle="Resumen de proyectos y tareas por workspace"
      />
      {workspaces.length === 0 ? (
        <Empty description="Crea un workspace para ver estadisticas" />
      ) : (
        <>
          <Select
            style={{ width: 280, marginBottom: 24 }}
            value={workspaceId}
            onChange={setWorkspaceId}
            options={workspaces.map((w) => ({ value: w.id, label: `${w.icon ?? "📁"} ${w.name}` }))}
          />
          {stats && (
            <div className="stat-grid">
              <Card className="stat-card">
                <Typography.Text type="secondary">Proyectos</Typography.Text>
                <Typography.Title level={2} style={{ margin: "4px 0 0" }}>{stats.totalProjects}</Typography.Title>
              </Card>
              <Card className="stat-card">
                <Typography.Text type="secondary">Abiertas</Typography.Text>
                <Typography.Title level={2} style={{ margin: "4px 0 0", color: "#fbbf24" }}>{stats.openTasks}</Typography.Title>
              </Card>
              <Card className="stat-card">
                <Typography.Text type="secondary">Completadas</Typography.Text>
                <Typography.Title level={2} style={{ margin: "4px 0 0", color: "#34d399" }}>{stats.doneTasks}</Typography.Title>
              </Card>
            </div>
          )}
          {chartData.length > 0 && (
            <Card className="panel-card" title={<><BarChartOutlined style={{ color: "#6366f1" }} /> Tareas por miembro</>}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#16161f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
                  />
                  <Bar dataKey="count" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
