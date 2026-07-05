import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { Button, Input, Typography } from "antd";
import { useState } from "react";
import type { WorkGuideStep } from "../../../types/proyecfer";

type Props = {
  steps: WorkGuideStep[];
  editing: boolean;
  activeStepId: string | null;
  onSelectStep: (id: string) => void;
  onUpdateStep: (stepId: string, patch: Partial<WorkGuideStep>) => void;
  onDeleteStep: (stepId: string) => void;
  onMoveStep: (stepId: string, direction: "up" | "down") => void;
};

export function WorkGuideTimeline({
  steps,
  editing,
  activeStepId,
  onSelectStep,
  onUpdateStep,
  onDeleteStep,
  onMoveStep,
}: Props) {
  if (steps.length === 0) {
    return (
      <Typography.Paragraph type="secondary" style={{ textAlign: "center", padding: 32 }}>
        Agrega el primer paso para documentar tu proceso
      </Typography.Paragraph>
    );
  }

  return (
    <div className="work-guide-timeline">
      {steps.map((step, index) => (
        <WorkGuideStepItem
          key={step.id}
          step={step}
          index={index}
          total={steps.length}
          editing={editing}
          active={activeStepId === step.id}
          onSelect={() => onSelectStep(step.id)}
          onUpdate={(patch) => onUpdateStep(step.id, patch)}
          onDelete={() => onDeleteStep(step.id)}
          onMove={(dir) => onMoveStep(step.id, dir)}
        />
      ))}
    </div>
  );
}

function WorkGuideStepItem({
  step,
  index,
  total,
  editing,
  active,
  onSelect,
  onUpdate,
  onDelete,
  onMove,
}: {
  step: WorkGuideStep;
  index: number;
  total: number;
  editing: boolean;
  active: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<WorkGuideStep>) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [localEdit, setLocalEdit] = useState(false);

  return (
    <div className="work-guide-step">
      <div className="work-guide-step__number">{index + 1}</div>
      <div
        className={`work-guide-step__card ${active || localEdit ? "work-guide-step__card--active" : ""}`}
        onClick={() => !editing && onSelect()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
      >
        {editing && localEdit ? (
          <StepEditor step={step} onSave={onUpdate} onCancel={() => setLocalEdit(false)} />
        ) : (
          <>
            <h3 className="work-guide-step__title">{step.title}</h3>
            {step.summary && <p className="work-guide-step__summary">{step.summary}</p>}
            {step.content && <p className="work-guide-step__content">{step.content}</p>}
            {step.tips && (
              <div className="work-guide-step__tips">
                <div className="work-guide-step__tips-label">
                  <BulbOutlined /> Consejo
                </div>
                {step.tips}
              </div>
            )}
            {step.durationMin != null && step.durationMin > 0 && (
              <div className="work-guide-step__duration">
                <ClockCircleOutlined /> ~{step.durationMin} min
              </div>
            )}
          </>
        )}
        {editing && !localEdit && (
          <div className="work-guide-step__actions">
            <Button size="small" icon={<EditOutlined />} onClick={() => setLocalEdit(true)}>
              Editar
            </Button>
            <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => onMove("up")} />
            <Button size="small" icon={<ArrowDownOutlined />} disabled={index === total - 1} onClick={() => onMove("down")} />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
          </div>
        )}
      </div>
    </div>
  );
}

function StepEditor({
  step,
  onSave,
  onCancel,
}: {
  step: WorkGuideStep;
  onSave: (patch: Partial<WorkGuideStep>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(step.title);
  const [summary, setSummary] = useState(step.summary ?? "");
  const [content, setContent] = useState(step.content ?? "");
  const [tips, setTips] = useState(step.tips ?? "");
  const [duration, setDuration] = useState(step.durationMin?.toString() ?? "");

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titulo del paso" style={{ marginBottom: 8, fontWeight: 600 }} />
      <Input.TextArea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Resumen breve" rows={2} style={{ marginBottom: 8 }} />
      <Input.TextArea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Instrucciones detalladas..." rows={4} style={{ marginBottom: 8 }} />
      <Input.TextArea value={tips} onChange={(e) => setTips(e.target.value)} placeholder="Consejo o advertencia (opcional)" rows={2} style={{ marginBottom: 8 }} />
      <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duracion (min)" style={{ marginBottom: 12, maxWidth: 140 }} addonBefore={<ClockCircleOutlined />} />
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          type="primary"
          className="btn-proyec"
          size="small"
          onClick={() => {
            onSave({
              title,
              summary: summary || null,
              content: content || null,
              tips: tips || null,
              durationMin: duration ? parseInt(duration, 10) : null,
            });
            onCancel();
          }}
        >
          Guardar paso
        </Button>
        <Button size="small" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
