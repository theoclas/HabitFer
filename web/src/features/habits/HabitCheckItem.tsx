import { CheckCircleFilled, CheckCircleOutlined, FireOutlined } from "@ant-design/icons";
import { List, Tag, Typography } from "antd";
import type { Habit, HabitToday } from "../../types";

type Props = {
  habit: Habit | HabitToday;
  loading?: boolean;
  onToggle: (habit: Habit | HabitToday) => void | Promise<void>;
  onOpen?: (habit: Habit | HabitToday) => void;
};

export function HabitCheckItem({ habit, loading, onToggle, onOpen }: Props) {
  const completed = habit.completedToday;

  return (
    <List.Item
      style={{
        padding: "14px 12px",
        marginBottom: 8,
        borderRadius: 12,
        background: "#1e293b",
        border: "1px solid #334155",
      }}
      onClick={() => onOpen?.(habit)}
    >
      <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 12 }}>
        <button
          type="button"
          aria-label={completed ? "Marcar pendiente" : "Marcar completado"}
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(habit);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 28,
            lineHeight: 1,
            cursor: loading ? "wait" : "pointer",
            color: completed ? habit.color : "#64748b",
          }}
        >
          {completed ? <CheckCircleFilled /> : <CheckCircleOutlined />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text strong style={{ color: completed ? "#94a3b8" : "#f1f5f9", textDecoration: completed ? "line-through" : "none" }}>
            {habit.title}
          </Typography.Text>
          {habit.streakEnabled && habit.currentStreak > 0 && (
            <div style={{ marginTop: 4 }}>
              <Tag icon={<FireOutlined />} color="volcano">{habit.currentStreak} dias</Tag>
            </div>
          )}
        </div>
        <div style={{ width: 8, height: 40, borderRadius: 4, background: habit.color }} />
      </div>
    </List.Item>
  );
}

