import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import type { Task, TaskStatus } from "../../types";
import { STATUS_LABEL, TaskCard } from "./TaskCard";

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

type Props = {
  tasks: Task[];
  onStatus: (task: Task, to: TaskStatus) => void;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
};

/** Tablero Pendiente / En progreso / Hecha: se arrastra (toque largo en el celular) o con el boton →. */
export function TaskBoard({ tasks, onStatus, onToggle, onOpen }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const title = (id: string | number) => tasks.find((t) => t.id === id)?.title ?? "la tarea";
  const column = (id: string | number | undefined) => (id && COLUMNS.includes(id as TaskStatus) ? STATUS_LABEL[id as TaskStatus] : "");
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste ${title(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${title(active.id)} sobre ${column(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${title(active.id)} pasó a ${column(over.id)}.` : `Soltaste ${title(active.id)}.`),
    onDragCancel: ({ active }) => `Se canceló. ${title(active.id)} se queda donde estaba.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const to = over?.id as TaskStatus | undefined;
    const task = tasks.find((t) => t.id === active.id);
    if (task && to && COLUMNS.includes(to) && task.status !== to) onStatus(task, to);
  };

  const active = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: "Para mover una tarea, presiona espacio, muévela con las flechas a otra columna y vuelve a presionar espacio." },
      }}
    >
      <div className="hf-board">
        {COLUMNS.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            onStatus={onStatus}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <TaskCard task={active} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function BoardColumn({ status, tasks, onStatus, onToggle, onOpen }: { status: TaskStatus } & Omit<Props, "tasks"> & { tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`hf-board__col hf-board__col--${status.toLowerCase()}${isOver ? " is-over" : ""}`} aria-label={STATUS_LABEL[status]}>
      <header>
        <b>{STATUS_LABEL[status]}</b>
        <span>{tasks.length}</span>
      </header>
      <div className="hf-board__list">
        {tasks.map((t) => (
          <DraggableTask key={t.id} task={t} onStatus={onStatus} onToggle={onToggle} onOpen={onOpen} />
        ))}
        {tasks.length === 0 && <p className="hf-board__empty">{status === "DONE" ? "Lo que termines aparece aquí" : "Suelta una tarea aquí"}</p>}
      </div>
    </section>
  );
}

function DraggableTask({ task, onStatus, onToggle, onOpen }: { task: Task } & Omit<Props, "tasks">) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="hf-board__item" style={{ opacity: isDragging ? 0.35 : 1 }}>
      <TaskCard task={task} onToggle={onToggle} onOpen={onOpen} onMove={onStatus} />
    </div>
  );
}
