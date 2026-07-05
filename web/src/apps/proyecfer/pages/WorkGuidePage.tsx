import {
  BookOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Input, Modal, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BackButton } from "../../../components/BackButton";
import {
  addWorkGuideStep,
  deleteWorkGuideStep,
  fetchWorkGuide,
  reorderWorkGuideSteps,
  updateWorkGuide,
  updateWorkGuideStep,
} from "../../../api/proyecfer";
import { CommentPanel } from "../components/CommentPanel";
import { WorkGuideTimeline } from "../components/WorkGuideTimeline";
import type { WorkGuideDetail, WorkGuideStep } from "../../../types/proyecfer";

export function WorkGuidePage() {
  const { workspaceId, projectId, guideId } = useParams<{
    workspaceId: string;
    projectId: string;
    guideId: string;
  }>();
  const [guide, setGuide] = useState<WorkGuideDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState("");

  const load = useCallback(async () => {
    if (!guideId) return;
    try {
      const g = await fetchWorkGuide(guideId);
      setGuide(g);
      setActiveStepId((prev) => prev ?? g.steps[0]?.id ?? null);
    } catch {
      message.error("No se pudo cargar la guia");
    }
  }, [guideId]);

  useEffect(() => { void load(); }, [load]);

  const totalMinutes = useMemo(
    () => guide?.steps.reduce((acc, s) => acc + (s.durationMin ?? 0), 0) ?? 0,
    [guide],
  );

  const handleUpdateGuideField = async (field: "title" | "description", value: string) => {
    if (!guideId || !guide) return;
    try {
      await updateWorkGuide(guideId, { [field]: value });
      setGuide({ ...guide, [field]: value });
    } catch {
      message.error("No se pudo guardar");
    }
  };

  const handleUpdateStep = async (stepId: string, patch: Partial<WorkGuideStep>) => {
    try {
      await updateWorkGuideStep(stepId, {
        title: patch.title,
        summary: patch.summary ?? undefined,
        content: patch.content ?? undefined,
        tips: patch.tips ?? undefined,
        durationMin: patch.durationMin,
      });
      await load();
    } catch {
      message.error("No se pudo guardar el paso");
    }
  };

  const handleAddStep = async () => {
    if (!guideId || !newStepTitle.trim()) return;
    try {
      await addWorkGuideStep(guideId, { title: newStepTitle.trim() });
      message.success("Paso agregado");
      setAddModalOpen(false);
      setNewStepTitle("");
      await load();
    } catch {
      message.error("No se pudo agregar");
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    try {
      await deleteWorkGuideStep(stepId);
      await load();
    } catch {
      message.error("No se pudo eliminar");
    }
  };

  const handleMoveStep = async (stepId: string, direction: "up" | "down") => {
    if (!guide) return;
    const ids = guide.steps.map((s) => s.id);
    const idx = ids.indexOf(stepId);
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    try {
      const steps = await reorderWorkGuideSteps(guide.id, ids);
      setGuide({ ...guide, steps });
    } catch {
      message.error("No se pudo reordenar");
    }
  };

  if (!guide) return null;

  const projectColor = guide.project.color;

  return (
    <div>
      {workspaceId && projectId && (
        <BackButton
          to={`/app/proyecfer/workspaces/${workspaceId}/projects/${projectId}`}
          label="Volver al proyecto"
        />
      )}

      <div className="guide-hero" style={{ borderColor: `${projectColor}33` }}>
        <div className="guide-hero__icon">{guide.icon ?? "📋"}</div>
        <Input
          value={guide.title}
          onChange={(e) => setGuide({ ...guide, title: e.target.value })}
          onBlur={(e) => void handleUpdateGuideField("title", e.target.value)}
          onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
          className="guide-hero__title guide-hero__title--editable"
          variant="borderless"
          aria-label="Nombre de la guia"
        />
        <Input.TextArea
          value={guide.description ?? ""}
          onChange={(e) => setGuide({ ...guide, description: e.target.value })}
          onBlur={(e) => void handleUpdateGuideField("description", e.target.value)}
          placeholder="Describe el proposito de este proceso..."
          rows={2}
          className="guide-hero__description-editable"
          variant="borderless"
          autoSize={{ minRows: 1, maxRows: 3 }}
          aria-label="Descripcion de la guia"
        />
        <div className="guide-hero__meta">
          <span className="guide-meta-pill">
            <BookOutlined /> {guide.steps.length} pasos
          </span>
          {totalMinutes > 0 && (
            <span className="guide-meta-pill">~{totalMinutes} min total</span>
          )}
          {guide.category && <span className="guide-meta-pill">{guide.category}</span>}
          <span className="guide-meta-pill" style={{ borderColor: `${projectColor}44`, color: projectColor }}>
            {guide.project.name}
          </span>
        </div>
        <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
          <Button
            icon={editing ? <EyeOutlined /> : <EditOutlined />}
            onClick={() => setEditing(!editing)}
            type={editing ? "default" : "primary"}
            className={editing ? "" : "btn-proyec"}
          >
            {editing ? "Vista previa" : "Editar pasos"}
          </Button>
          {editing && (
            <Button icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
              Agregar paso
            </Button>
          )}
        </div>
      </div>

      <div className="split-layout split-layout--sidebar">
        <WorkGuideTimeline
          steps={guide.steps}
          editing={editing}
          activeStepId={activeStepId}
          onSelectStep={setActiveStepId}
          onUpdateStep={handleUpdateStep}
          onDeleteStep={handleDeleteStep}
          onMoveStep={handleMoveStep}
        />
        <CommentPanel targetType="WORK_GUIDE" targetId={guide.id} />
      </div>

      <Modal
        title="Nuevo paso"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        onOk={() => void handleAddStep()}
        okText="Agregar"
        okButtonProps={{ className: "btn-proyec" }}
      >
        <Input
          value={newStepTitle}
          onChange={(e) => setNewStepTitle(e.target.value)}
          placeholder="Ej: Revisar requisitos previos"
          size="large"
          onPressEnter={() => void handleAddStep()}
        />
      </Modal>
    </div>
  );
}
