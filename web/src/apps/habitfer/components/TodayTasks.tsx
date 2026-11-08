import { message } from "antd";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { updateTask } from "../../../api/client";
import type { Task } from "../../../types";
import { formatCalendarDate } from "../../../utils/dates";
import { buzz } from "../effects";

type Props = {
  tasks: Task[];
  onChange: (tasks: Task[]) => void;
};

const PRIORITY_LABEL: Record<Task["priority"], string> = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };

/** Tareas que vencen hoy (o vencidas) dentro de Hoy. Se marcan igual que un habito. */
export function TodayTasks({ tasks, onChange }: Props) {
  const navigate = useNavigate();
  const pending = useRef(new Set<string>());

  if (tasks.length === 0) return null;

  const toggle = async (task: Task) => {
    if (pending.current.has(task.id)) return;
    const next = task.status === "DONE" ? "TODO" : "DONE";
    const before = tasks;
    pending.current.add(task.id);
    if (next === "DONE") buzz();
    onChange(tasks.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await updateTask(task.id, { status: next });
    } catch {
      onChange(before);
      message.error("No se pudo actualizar la tarea, la deje como estaba");
    } finally {
      pending.current.delete(task.id);
    }
  };

  return (
    <section className="hf-section hf-tasks" aria-label="Tareas de hoy">
      <div className="hf-section__head">
        <span>Tareas de hoy</span>
        <button type="button" className="hf-link" onClick={() => navigate("/app/habitfer/tasks", { viewTransition: true })}>
          Ver todas
        </button>
      </div>
      {tasks.map((task) => {
        const done = task.status === "DONE";
        return (
          <div key={task.id} className={`hf-task${done ? " is-done" : ""}`}>
            <button
              type="button"
              className="hf-task__check"
              aria-label={done ? `Desmarcar ${task.title}` : `Marcar ${task.title}`}
              aria-pressed={done}
              onClick={() => void toggle(task)}
            >
              {done && (
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div style={{ minWidth: 0 }}>
              <div className="hf-task__title">{task.title}</div>
              <div className="hf-task__meta">
                {task.overdue && !done && <span className="is-late">Vencida {task.dueDate ? formatCalendarDate(task.dueDate, "D MMM") : ""}</span>}
                {task.dueTime && <span>{task.dueTime}</span>}
                {task.priority === "HIGH" ? <span className="is-high">Prioridad alta</span> : <span>Prioridad {PRIORITY_LABEL[task.priority].toLowerCase()}</span>}
                {task.project && <span style={{ color: task.project.color }}>{task.project.name}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
