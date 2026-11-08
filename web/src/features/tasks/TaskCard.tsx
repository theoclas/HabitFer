import dayjs from "dayjs";
import type { CSSProperties } from "react";
import type { Task, TaskStatus } from "../../types";

export const PRIORITY_LABEL: Record<Task["priority"], string> = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };
export const STATUS_LABEL: Record<TaskStatus, string> = { TODO: "Pendiente", IN_PROGRESS: "En progreso", DONE: "Hecha" };
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = { TODO: "IN_PROGRESS", IN_PROGRESS: "DONE", DONE: "TODO" };

/** "hoy · 15:00", "mañana", "viernes", "13 nov". */
export function dueLabel(task: Pick<Task, "dueDate" | "dueTime">): string | null {
  if (!task.dueDate) return null;
  const d = dayjs(task.dueDate);
  const diff = d.startOf("day").diff(dayjs().startOf("day"), "day");
  const base =
    diff === 0 ? "hoy" : diff === 1 ? "mañana" : diff === -1 ? "ayer" : diff > 1 && diff < 7 ? d.format("dddd") : d.format("D MMM");
  return task.dueTime ? `${base} · ${task.dueTime}` : base;
}

type Props = {
  task: Task;
  onToggle?: (task: Task) => void;
  onOpen?: (task: Task) => void;
  /** En el tablero: boton para pasarla a la siguiente columna. */
  onMove?: (task: Task, to: TaskStatus) => void;
  dragging?: boolean;
};

/** Tarea con el estilo de HabitFer: check, titulo, vencimiento, prioridad y proyecto. */
export function TaskCard({ task, onToggle, onOpen, onMove, dragging }: Props) {
  const done = task.status === "DONE";
  const due = dueLabel(task);
  const late = task.overdue && !done;
  const next = NEXT_STATUS[task.status];
  return (
    <div
      className={`hf-task hf-task--card${done ? " is-done" : ""}${dragging ? " is-dragging" : ""}${task.status === "IN_PROGRESS" ? " is-doing" : ""}`}
      style={{ "--c": task.project?.color ?? "var(--hf-line-strong)" } as CSSProperties}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(task)}
      onKeyDown={(e) => {
        if (onOpen && e.key === "Enter" && e.target === e.currentTarget) onOpen(task);
      }}
    >
      {onToggle && (
        <button
          type="button"
          className="hf-task__check"
          aria-label={done ? `Reabrir ${task.title}` : `Marcar ${task.title}`}
          aria-pressed={done}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task);
          }}
        >
          {done && (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="hf-task__title">{task.title}</div>
        <div className="hf-task__meta">
          {due && <span className={late ? "is-late" : undefined}>{late ? `Vencida · ${due}` : due}</span>}
          {task.priority === "HIGH" ? <span className="is-high">Prioridad alta</span> : task.priority === "LOW" ? <span>Prioridad baja</span> : null}
          {task.project && <span style={{ color: task.project.color }}># {task.project.name}</span>}
        </div>
      </div>
      {onMove && (
        <button
          type="button"
          className="hf-task__move"
          aria-label={`Pasar ${task.title} a ${STATUS_LABEL[next]}`}
          title={`Pasar a ${STATUS_LABEL[next]}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onMove(task, next);
          }}
        >
          {task.status === "DONE" ? "↺" : "→"}
        </button>
      )}
    </div>
  );
}
