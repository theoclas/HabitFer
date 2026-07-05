import { CheckOutlined, EditOutlined, FireOutlined, PlusOutlined } from "@ant-design/icons";
import type { Habit, HabitToday } from "../../types";
import { habitCardBackground, habitEmoji, habitScheduleLabel } from "./habitUtils";

type Props = {
  habit: Habit | HabitToday;
  loading?: boolean;
  layout?: "list" | "grid";
  onToggle: (habit: Habit | HabitToday) => void | Promise<void>;
  onOpen?: (habit: Habit | HabitToday) => void;
  onEdit?: (habit: Habit | HabitToday) => void;
};

export function HabitCard({ habit, loading, layout = "list", onToggle, onOpen, onEdit }: Props) {
  const completed = habit.completedToday;
  const isGrid = layout === "grid";

  return (
    <div
      role="button"
      tabIndex={0}
      className="habit-card"
      onClick={() => onOpen?.(habit)}
      onKeyDown={(e) => e.key === "Enter" && onOpen?.(habit)}
      style={{
        display: "flex",
        flexDirection: isGrid ? "column" : "row",
        alignItems: isGrid ? "stretch" : "center",
        gap: isGrid ? 12 : 14,
        padding: isGrid ? "20px" : "18px 20px",
        marginBottom: isGrid ? 0 : 14,
        borderRadius: isGrid ? 20 : 22,
        background: habitCardBackground(habit.color),
        border: "none",
        boxShadow: `0 4px 24px ${habit.color}22`,
        cursor: onOpen || onEdit ? "pointer" : "default",
        opacity: completed ? 0.85 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: isGrid ? undefined : 1, minWidth: 0 }}>
        <div
          style={{
            width: isGrid ? 56 : 48,
            height: isGrid ? 56 : 48,
            borderRadius: 14,
            background: "rgba(0,0,0,0.25)",
            display: "grid",
            placeItems: "center",
            fontSize: isGrid ? 30 : 26,
            flexShrink: 0,
          }}
        >
          {habitEmoji(habit.icon)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: isGrid ? 18 : 17,
              color: completed ? "#94a3b8" : "#f8fafc",
              textDecoration: completed ? "line-through" : "none",
              lineHeight: 1.3,
            }}
          >
            {habit.title}
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{habitScheduleLabel(habit)}</div>
          {habit.streakEnabled && habit.currentStreak > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 8,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(249, 115, 22, 0.2)",
                color: "#fb923c",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <FireOutlined /> {habit.currentStreak} dias
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          justifyContent: isGrid ? "flex-end" : undefined,
          marginTop: isGrid ? "auto" : 0,
        }}
      >
        {onEdit && (
          <button
            type="button"
            aria-label="Editar habito"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(habit);
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.28)",
              color: "#e2e8f0",
              fontSize: 16,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <EditOutlined />
          </button>
        )}
        <button
          type="button"
          aria-label={completed ? "Desmarcar" : "Completar"}
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            void onToggle(habit);
          }}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: completed ? "none" : `2px solid ${habit.color}`,
            background: completed ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.28)",
            color: completed ? habit.color : "#f8fafc",
            fontSize: 22,
            display: "grid",
            placeItems: "center",
            cursor: loading ? "wait" : "pointer",
            flexShrink: 0,
            transition: "transform 0.15s",
          }}
        >
          {completed ? <CheckOutlined /> : <PlusOutlined />}
        </button>
      </div>
    </div>
  );
}
