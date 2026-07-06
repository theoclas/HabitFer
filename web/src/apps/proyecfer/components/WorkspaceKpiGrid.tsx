import {
  BookOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  FolderOutlined,
  LineChartOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Card, Progress, Typography } from "antd";
import type { ProyecFerStats } from "../../../types/proyecfer";

type Props = { stats: ProyecFerStats };

const KPI_ITEMS = [
  { key: "totalProjects", label: "Proyectos", icon: FolderOutlined, color: "#818cf8" },
  { key: "openTasks", label: "Tareas abiertas", icon: UnorderedListOutlined, color: "#fbbf24" },
  { key: "doneTasks", label: "Completadas", icon: CheckCircleOutlined, color: "#34d399" },
  { key: "totalMembers", label: "Miembros", icon: TeamOutlined, color: "#38bdf8" },
  { key: "totalGuides", label: "Guias", icon: BookOutlined, color: "#a78bfa" },
  { key: "totalPages", label: "Paginas", icon: FileTextOutlined, color: "#fb7185" },
] as const;

export function WorkspaceKpiGrid({ stats }: Props) {
  const values: Record<string, number> = {
    totalProjects: stats.totalProjects,
    openTasks: stats.openTasks,
    doneTasks: stats.doneTasks,
    totalMembers: stats.totalMembers ?? 0,
    totalGuides: stats.totalGuides ?? 0,
    totalPages: stats.totalPages ?? 0,
  };

  return (
    <div className="stat-grid workspace-kpi-grid">
      {KPI_ITEMS.map(({ key, label, icon: Icon, color }) => (
        <Card key={key} className="stat-card workspace-kpi-card" styles={{ body: { padding: "18px 20px" } }}>
          <div className="workspace-kpi-card__head">
            <span className="workspace-kpi-card__icon" style={{ background: `${color}22`, color }}>
              <Icon />
            </span>
            <Typography.Text type="secondary" className="workspace-kpi-card__label">
              {label}
            </Typography.Text>
          </div>
          <Typography.Title level={2} style={{ margin: "8px 0 0", color }}>
            {values[key]}
          </Typography.Title>
        </Card>
      ))}
      {(stats.dailyTaskCount ?? 0) > 0 && (
        <Card className="stat-card workspace-kpi-card workspace-kpi-card--progress" styles={{ body: { padding: "18px 20px" } }}>
          <div className="workspace-kpi-card__head">
            <span className="workspace-kpi-card__icon" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
              <LineChartOutlined />
            </span>
            <Typography.Text type="secondary" className="workspace-kpi-card__label">
              Rutinas diarias
            </Typography.Text>
          </div>
          <div className="workspace-kpi-card__progress">
            <Progress
              type="circle"
              percent={stats.dailyComplianceRate7d ?? 0}
              size={72}
              strokeColor={{ "0%": "#818cf8", "100%": "#34d399" }}
              trailColor="rgba(255,255,255,0.08)"
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
              {stats.dailyTaskCount} rutinas · 7 dias
            </Typography.Text>
          </div>
        </Card>
      )}
      {(stats.completionRate ?? 0) >= 0 && stats.totalTasks !== undefined && stats.totalTasks > 0 && (
        <Card className="stat-card workspace-kpi-card workspace-kpi-card--progress" styles={{ body: { padding: "18px 20px" } }}>
          <Typography.Text type="secondary" className="workspace-kpi-card__label">
            Avance general
          </Typography.Text>
          <div className="workspace-kpi-card__progress">
            <Progress
              type="circle"
              percent={stats.completionRate ?? 0}
              size={72}
              strokeColor={{ "0%": "#818cf8", "100%": "#34d399" }}
              trailColor="rgba(255,255,255,0.08)"
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
              {stats.doneTasks} de {stats.totalTasks} tareas
            </Typography.Text>
          </div>
        </Card>
      )}
    </div>
  );
}
