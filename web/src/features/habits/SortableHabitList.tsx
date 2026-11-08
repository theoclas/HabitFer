import { HolderOutlined } from "@ant-design/icons";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import type { Habit } from "../../types";
import { habitEmoji, habitScheduleLabel } from "./habitUtils";

type Props = {
  items: Habit[];
  onChange: (next: Habit[]) => void;
};

/** Lista para ordenar arrastrando del agarre (o con teclado: espacio y flechas). */
export function SortableHabitList({ items, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const title = (id: string | number) => items.find((h) => h.id === id)?.title ?? "el hábito";
  const position = (id: string | number) => items.findIndex((h) => h.id === id) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste ${title(active.id)}. Está en la posición ${position(active.id)} de ${items.length}.`,
    onDragOver: ({ active, over }) => (over ? `${title(active.id)} pasa a la posición ${position(over.id)} de ${items.length}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Soltaste ${title(active.id)} en la posición ${position(over.id)} de ${items.length}.` : `Soltaste ${title(active.id)}.`),
    onDragCancel: ({ active }) => `Se canceló. ${title(active.id)} vuelve a su lugar.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((h) => h.id === active.id);
    const to = items.findIndex((h) => h.id === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(items, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Para mover un hábito, presiona espacio, muévelo con las flechas y vuelve a presionar espacio para soltarlo. Escape cancela.",
        },
      }}
    >
      <SortableContext items={items.map((h) => h.id)} strategy={verticalListSortingStrategy}>
        <ul className="hf-sort-list">
          {items.map((h) => (
            <SortableRow key={h.id} habit={h} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ habit }: { habit: Habit }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    "--c": habit.color,
  } as CSSProperties;
  return (
    <li ref={setNodeRef} className={`hf-sort-row${isDragging ? " is-dragging" : ""}`} style={style}>
      <span className="hf-card__emoji" aria-hidden="true">
        {habitEmoji(habit.icon)}
      </span>
      <span className="hf-sort-row__text">
        <b>{habit.title}</b>
        <small>{habitScheduleLabel(habit)}</small>
      </span>
      <button
        type="button"
        className="hf-sort-row__handle"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Mover ${habit.title}`}
      >
        <HolderOutlined />
      </button>
    </li>
  );
}
