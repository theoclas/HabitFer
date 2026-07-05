import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { HabitCard } from "./HabitCard";
import type { Habit } from "../../types";

type Props = {
  id: string;
  title: string;
  habits: Habit[];
  togglingId: string | null;
  layout: "list" | "grid";
  defaultCollapsed?: boolean;
  onToggle: (habit: Habit) => void;
  onOpen?: (habit: Habit) => void;
  onEdit?: (habit: Habit) => void;
};

function readCollapsed(id: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(`habitfer.section.${id}`);
    if (stored === null) return fallback;
    return stored === "1";
  } catch {
    return fallback;
  }
}

export function CollapsibleHabitSection({
  id,
  title,
  habits,
  togglingId,
  layout,
  defaultCollapsed = false,
  onToggle,
  onOpen,
  onEdit,
}: Props) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(id, defaultCollapsed));

  useEffect(() => {
    try {
      localStorage.setItem(`habitfer.section.${id}`, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [id, collapsed]);

  if (habits.length === 0) return null;

  return (
    <section style={{ marginBottom: 20 }}>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 4px",
          marginBottom: collapsed ? 0 : 12,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "#94a3b8",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {title}
        </span>
        {collapsed ? <DownOutlined style={{ fontSize: 12 }} /> : <UpOutlined style={{ fontSize: 12 }} />}
      </button>

      {!collapsed && (
        <div className={layout === "grid" ? "habit-grid" : undefined}>
          {habits.map((habit) => (
            <HabitCard
              key={habit.id + id}
              habit={habit}
              layout={layout}
              loading={togglingId === habit.id}
              onToggle={onToggle}
              onOpen={onOpen ? () => onOpen(habit) : undefined}
              onEdit={onEdit ? () => onEdit(habit) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
