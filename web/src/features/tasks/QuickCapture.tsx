import { ThunderboltOutlined } from "@ant-design/icons";
import { Button, Input, message, type InputRef } from "antd";
import dayjs from "dayjs";
import { forwardRef, useMemo, useState } from "react";
import { createTask } from "../../api/client";
import { apiErrorMessage } from "../../apps/habitfer/format";
import type { Project, Task } from "../../types";
import { parseQuickTask } from "./parseQuickTask";
import { dueLabel } from "./TaskCard";

type Props = {
  projects: Project[];
  /** Proyecto por defecto (el filtro abierto), si no se escribe #proyecto. */
  defaultProjectId?: string | null;
  onCreated: (task: Task) => void;
};

/** Caja que entiende "mañana 3pm llamar a Juan !alta #trabajo" y crea la tarea con Enter. */
export const QuickCapture = forwardRef<InputRef, Props>(function QuickCapture({ projects, defaultProjectId, onCreated }, ref) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    const now = dayjs();
    return parseQuickTask(text, { todayKey: now.format("YYYY-MM-DD"), minutes: now.hour() * 60 + now.minute() }, projects);
  }, [text, projects]);

  const submit = async () => {
    if (!parsed?.title || saving) return;
    setSaving(true);
    try {
      const task = await createTask({
        title: parsed.title,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        dueTime: parsed.dueTime,
        projectId: parsed.projectId ?? defaultProjectId ?? null,
        reminderEnabled: parsed.reminderEnabled,
      });
      const due = dueLabel(task);
      message.success(due ? `Tarea para ${due}${task.reminderEnabled ? " · con aviso" : ""}` : "Tarea creada");
      setText("");
      onCreated(task);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo crear la tarea"));
    } finally {
      setSaving(false);
    }
  };

  const chips = parsed
    ? [
        ...(parsed.dueDate ? [{ k: "date", t: `📅 ${dueLabel({ dueDate: parsed.dueDate, dueTime: null })}` }] : []),
        ...(parsed.dueTime ? [{ k: "time", t: `⏰ ${parsed.dueTime} · con aviso` }] : []),
        ...(parsed.priority !== "MEDIUM" ? [{ k: "prio", t: parsed.priority === "HIGH" ? "🔥 Alta" : "Baja" }] : []),
        ...(parsed.projectTag
          ? [{ k: "proj", t: parsed.projectId ? `# ${projects.find((p) => p.id === parsed.projectId)?.name}` : `#${parsed.projectTag} no existe`, warn: !parsed.projectId }]
          : []),
      ]
    : [];

  return (
    <div className="hf-capture">
      <div className="hf-capture__row">
        <Input
          ref={ref}
          size="large"
          prefix={<ThunderboltOutlined style={{ color: "var(--hf-ember)" }} />}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPressEnter={() => void submit()}
          maxLength={240}
          placeholder="mañana 3pm llamar a Juan !alta #trabajo"
          aria-label="Nueva tarea rápida"
        />
        <Button size="large" type="primary" loading={saving} disabled={!parsed?.title} onClick={() => void submit()}>
          Agregar
        </Button>
      </div>
      {parsed && (chips.length > 0 || parsed.title) && (
        <div className="hf-capture__preview" aria-live="polite">
          <b>{parsed.title || "…"}</b>
          {chips.map((c) => (
            <span key={c.k} className={"warn" in c && c.warn ? "is-warn" : undefined}>
              {c.t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
