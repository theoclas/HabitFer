import type { CSSProperties } from "react";
import { BookOutlined, LineChartOutlined, RightOutlined } from "@ant-design/icons";
import { Card, Empty, Progress, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import type { WorkspaceProjectSummary } from "../../../types/proyecfer";

type Props = {
  workspaceId: string;
  projects: WorkspaceProjectSummary[];
};

export function WorkspaceProjectGrid({ workspaceId, projects }: Props) {
  if (projects.length === 0) {
    return (
      <Card className="panel-card" title="Proyectos">
        <Empty description="Sin proyectos en este workspace" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <Card
      className="panel-card"
      title={
        <span>
          Proyectos <Tag style={{ marginLeft: 8 }}>{projects.length}</Tag>
        </span>
      }
    >
      <div className="workspace-project-grid">
        {projects.map((p) => {
          const pct = p.totalTasks > 0 ? Math.round((p.doneTasks / p.totalTasks) * 100) : 0;
          const dailyPct = p.dailyComplianceRate7d ?? 0;
          return (
            <Link
              key={p.id}
              to={`/app/proyecfer/workspaces/${workspaceId}/projects/${p.id}`}
              className="workspace-project-card"
              style={{ "--project-color": p.color } as CSSProperties}
            >
              <div className="workspace-project-card__accent" />
              <div className="workspace-project-card__body">
                <div className="workspace-project-card__top">
                  <Typography.Text strong className="workspace-project-card__title">
                    {p.name}
                  </Typography.Text>
                  <RightOutlined className="workspace-project-card__arrow" />
                </div>
                {p.description && (
                  <Typography.Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    className="workspace-project-card__desc"
                  >
                    {p.description}
                  </Typography.Paragraph>
                )}
                <div className="workspace-project-card__stats">
                  <span>{p.openTasks} abiertas</span>
                  <span>{p.doneTasks} hechas</span>
                  {(p.dailyTaskCount ?? 0) > 0 && (
                    <span>
                      <LineChartOutlined /> {dailyPct}% rutinas
                    </span>
                  )}
                  {p.guideCount > 0 && (
                    <span>
                      <BookOutlined /> {p.guideCount} guias
                    </span>
                  )}
                </div>
                {p.totalTasks > 0 && (
                  <Progress
                    percent={pct}
                    size="small"
                    strokeColor={p.color}
                    trailColor="rgba(255,255,255,0.08)"
                    format={(n) => `${n}% unicas`}
                  />
                )}
                {(p.dailyTaskCount ?? 0) > 0 && (
                  <Progress
                    percent={dailyPct}
                    size="small"
                    strokeColor="#818cf8"
                    trailColor="rgba(255,255,255,0.08)"
                    format={(n) => `${n}% rutinas`}
                    style={{ marginTop: 6 }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
