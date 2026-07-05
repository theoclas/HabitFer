import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

const typesAppend = `

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type Project = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  openTasks: number;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  project: { id: string; name: string; color: string } | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  reminderEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
  dueToday: boolean;
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  projectId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
  reminderEnabled?: boolean;
};

export type CreateProjectPayload = {
  name: string;
  color?: string;
};
`;
fs.appendFileSync(path.join(root, "web/src/types.ts"), typesAppend, "utf8");

const clientAppend = `

import type { CreateProjectPayload, CreateTaskPayload, Project, Task, TaskStatus } from "../types";

export async function fetchProjects() {
  const { data } = await api.get<Project[]>("/projects");
  return data;
}

export async function createProject(payload: CreateProjectPayload) {
  const { data } = await api.post<Project>("/projects", payload);
  return data;
}

export async function updateProject(id: string, payload: Partial<CreateProjectPayload> & { archived?: boolean }) {
  const { data } = await api.patch<Project>("/projects/" + id, payload);
  return data;
}

export async function deleteProject(id: string) {
  await api.delete("/projects/" + id);
}

export async function fetchTasks(params?: { projectId?: string; status?: TaskStatus }) {
  const { data } = await api.get<Task[]>("/tasks", { params });
  return data;
}

export async function fetchTasksToday() {
  const { data } = await api.get<Task[]>("/tasks/today");
  return data;
}

export async function createTask(payload: CreateTaskPayload) {
  const { data } = await api.post<Task>("/tasks", payload);
  return data;
}

export async function updateTask(id: string, payload: Partial<CreateTaskPayload>) {
  const { data } = await api.patch<Task>("/tasks/" + id, payload);
  return data;
}

export async function deleteTask(id: string) {
  await api.delete("/tasks/" + id);
}
`;
fs.appendFileSync(path.join(root, "web/src/api/client.ts"), clientAppend, "utf8");

w("web/src/features/tasks/TaskItem.tsx", `import { CheckOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { Checkbox, List, Space, Tag, Typography } from "antd";
import dayjs from "dayjs";
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
                {dayjs(task.dueDate).format("DD MMM")}
              </Typography.Text>
            )}
          </Space>
        </div>
        {task.status === "IN_PROGRESS" && <CheckOutlined style={{ color: "#22d3ee" }} />}
      </div>
    </List.Item>
  );
}
`);

console.log("types + TaskItem ok");
