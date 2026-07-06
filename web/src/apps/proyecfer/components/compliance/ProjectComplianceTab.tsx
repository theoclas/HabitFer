import { Button, Empty, Spin, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import {
  completeDailyCollabTask,
  fetchProjectCompliance,
  uncompleteDailyCollabTask,
} from "../../../../api/proyecfer";
import type { ComplianceReport, WorkspaceUser } from "../../../../types/proyecfer";
import { ComplianceByAssignee } from "./ComplianceByAssignee";
import { ComplianceHeatmap } from "./ComplianceHeatmap";
import { ComplianceKpiRow } from "./ComplianceKpiRow";
import { ComplianceToolbar, presetToRange, type ComplianceRangePreset } from "./ComplianceToolbar";
import { ComplianceTrendChart } from "./ComplianceTrendChart";
import type { Dayjs } from "dayjs";

type Props = {
  projectId: string;
  members: WorkspaceUser[];
  canEdit: boolean;
  onCreateRoutine: () => void;
};

export function ProjectComplianceTab({ projectId, members, canEdit, onCreateRoutine }: Props) {
  const [preset, setPreset] = useState<ComplianceRangePreset>("30d");
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const range = presetToRange(preset, customRange);
    try {
      setReport(
        await fetchProjectCompliance(projectId, {
          from: range.from,
          to: range.to,
          assigneeId: assigneeId ?? undefined,
        }),
      );
    } catch {
      message.error("No se pudo cargar el cumplimiento");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, preset, customRange, assigneeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (taskId: string, date: string, done: boolean) => {
    if (!canEdit) return;
    try {
      if (done) await uncompleteDailyCollabTask(taskId, date);
      else await completeDailyCollabTask(taskId, date);
      await load();
    } catch {
      message.error("No se pudo actualizar");
    }
  };

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 240 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!report || report.dailyTaskCount === 0) {
    return (
      <Empty description="Sin rutinas diarias en este proyecto">
        {canEdit && (
          <Button type="primary" className="btn-proyec" icon={<PlusOutlined />} onClick={onCreateRoutine}>
            Crear rutina diaria
          </Button>
        )}
      </Empty>
    );
  }

  return (
    <div className="compliance-dashboard">
      <div className="page-header">
        <Typography.Paragraph type="secondary" style={{ margin: 0, maxWidth: 560 }}>
          Seguimiento de rutinas diarias — cumplimiento por fecha, persona y tendencia del periodo.
        </Typography.Paragraph>
      </div>

      <ComplianceToolbar
        preset={preset}
        onPresetChange={setPreset}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        assigneeId={assigneeId}
        onAssigneeChange={setAssigneeId}
        members={members}
      />

      <ComplianceKpiRow report={report} />
      <ComplianceTrendChart report={report} />
      <ComplianceHeatmap report={report} canEdit={canEdit} onToggle={(id, d, done) => void handleToggle(id, d, done)} />
      <ComplianceByAssignee report={report} />
    </div>
  );
}
