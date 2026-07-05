import { CheckOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { Checkbox, List, Space, Tag, Typography } from "antd";
import { formatCalendarDate } from "../../utils/dates";
import type { Task } from "../../types";

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  LOW: "default",
  MEDIUM: "blue",
  HIGH: "red",
};

type Props = {
  task: Task;
  loading?: boolean;
  onToggle: (task: Task) => void | Promise<void>;
  onOpen?: (task: Task) => void;
};

export function TaskItem({ task, loading, onToggle, onOpen }: Props) {
  const done = task.status === "DONE";

  return (
    <List.Item
      style={{
        padding: "14px 12px",
        marginBottom: 8,
        borderRadius: 12,
        background: "#1e293b",
        border: "1px solid #334155",
        opacity: done ? 0.7 : 1,
      }}
      onClick={() => onOpen?.(task)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", width: "100%", gap: 12 }}>
        <Checkbox
          checked={done}
          disabled={loading}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggle(task)}
          style={{ marginTop: 4 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text delete={done} strong={!done}>
            {task.title}
          </Typography.Text>
          <Space size={4} wrap style={{ marginTop: 6 }}>
            <Tag color={PRIORITY_COLOR[task.priority]}>{task.priority}</Tag>
            {task.project && <Tag color={task.project.color}>{task.project.name}</Tag>}
            {task.overdue && !done && <Tag color="red">Vencida</Tag>}
            {task.dueToday && !done && <Tag icon={<ClockCircleOutlined />}>Hoy</Tag>}
            {task.dueDate && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {formatCalendarDate(task.dueDate, "DD MMM")}
              </Typography.Text>
            )}
          </Space>
        </div>
        {task.status === "IN_PROGRESS" && <CheckOutlined style={{ color: "#22d3ee" }} />}
      </div>
    </List.Item>
  );
}
