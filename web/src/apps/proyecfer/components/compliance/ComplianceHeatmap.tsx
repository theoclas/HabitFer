import { TableOutlined } from "@ant-design/icons";
import { Card, Empty, Tooltip, Typography } from "antd";
import type { ComplianceReport } from "../../../../types/proyecfer";
import { formatCalendarDate } from "../../../../utils/dates";

type Props = {
  report: ComplianceReport;
  canEdit: boolean;
  onToggle?: (taskId: string, date: string, done: boolean) => void;
};

export function ComplianceHeatmap({ report, canEdit, onToggle }: Props) {
  if (report.tasks.length === 0) {
    return (
      <Card className="panel-card compliance-heatmap-card">
        <Empty description="Crea rutinas diarias para ver el heatmap" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  const dates = report.trend.map((t) => t.date);

  return (
    <Card
      className="panel-card compliance-heatmap-card"
      title={
        <>
          <TableOutlined style={{ color: "#6366f1", marginRight: 8 }} />
          Mapa de cumplimiento
        </>
      }
    >
      <div className="compliance-heatmap-scroll">
        <table className="compliance-heatmap">
          <thead>
            <tr>
              <th>Rutina</th>
              {dates.map((d) => (
                <th key={d}>{formatCalendarDate(d, "DD")}</th>
              ))}
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {report.tasks.map((task) => (
              <tr key={task.taskId}>
                <td>
                  <Typography.Text strong style={{ fontSize: 13 }}>
                    {task.title}
                  </Typography.Text>
                  {task.assigneeName && (
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {task.assigneeName}
                      </Typography.Text>
                    </div>
                  )}
                </td>
                {task.days.map((cell) => (
                  <td key={cell.date}>
                    <Tooltip title={`${formatCalendarDate(cell.date, "DD MMM")} — ${cell.done ? "Hecho" : "Pendiente"}`}>
                      <button
                        type="button"
                        className={`compliance-cell ${cell.done ? "compliance-cell--done" : "compliance-cell--miss"}`}
                        disabled={!canEdit || !onToggle}
                        onClick={() => onToggle?.(task.taskId, cell.date, cell.done)}
                        aria-label={cell.done ? "Desmarcar" : "Marcar"}
                      />
                    </Tooltip>
                  </td>
                ))}
                <td>
                  <Typography.Text style={{ color: "#a5b4fc", fontWeight: 700 }}>
                    {task.rate}%
                  </Typography.Text>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="compliance-heatmap-legend">
        <span><i className="compliance-cell compliance-cell--done" /> Hecho</span>
        <span><i className="compliance-cell compliance-cell--miss" /> Pendiente</span>
      </div>
    </Card>
  );
}
