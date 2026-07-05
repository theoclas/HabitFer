import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

w("web/src/features/tasks/TaskForm.tsx", `import { ColorPicker, DatePicker, Form, Input, Select } from "antd";
import dayjs from "dayjs";
import type { CreateTaskPayload, Project, Task, TaskPriority, TaskStatus } from "../../types";

export type TaskFormValues = {
  title: string;
  description?: string;
  projectId?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: dayjs.Dayjs | null;
  dueTime?: dayjs.Dayjs | null;
};

type Props = {
  form: ReturnType<typeof Form.useForm<TaskFormValues>>[0];
  projects: Project[];
  initial?: Task | null;
  defaultProjectId?: string | null;
};

export function taskToFormValues(task?: Task | null, defaultProjectId?: string | null): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    projectId: task?.projectId ?? defaultProjectId ?? null,
    status: task?.status ?? "TODO",
    priority: task?.priority ?? "MEDIUM",
    dueDate: task?.dueDate ? dayjs(task.dueDate) : null,
    dueTime: task?.dueTime ? dayjs(task.dueTime, "HH:mm") : null,
  };
}

export function formValuesToPayload(values: TaskFormValues): CreateTaskPayload {
  return {
    title: values.title,
    description: values.description,
    projectId: values.projectId || null,
    status: values.status,
    priority: values.priority,
    dueDate: values.dueDate ? values.dueDate.format("YYYY-MM-DD") : null,
    dueTime: values.dueTime ? values.dueTime.format("HH:mm") : null,
  };
}

export function TaskForm({ form, projects, initial, defaultProjectId }: Props) {
  return (
    <Form form={form} layout="vertical" initialValues={taskToFormValues(initial, defaultProjectId)}>
      <Form.Item name="title" label="Titulo" rules={[{ required: true, message: "Escribe un titulo" }]}>
        <Input size="large" placeholder="Ej. Pagar factura" />
      </Form.Item>
      <Form.Item name="description" label="Descripcion">
        <Input.TextArea rows={2} placeholder="Opcional" />
      </Form.Item>
      <Form.Item name="projectId" label="Proyecto">
        <Select
          size="large"
          allowClear
          placeholder="Inbox (sin proyecto)"
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
        />
      </Form.Item>
      <Form.Item name="priority" label="Prioridad">
        <Select
          size="large"
          options={[
            { value: "LOW", label: "Baja" },
            { value: "MEDIUM", label: "Media" },
            { value: "HIGH", label: "Alta" },
          ]}
        />
      </Form.Item>
      <Form.Item name="status" label="Estado">
        <Select
          size="large"
          options={[
            { value: "TODO", label: "Pendiente" },
            { value: "IN_PROGRESS", label: "En progreso" },
            { value: "DONE", label: "Hecha" },
          ]}
        />
      </Form.Item>
      <Form.Item name="dueDate" label="Fecha limite">
        <DatePicker size="large" style={{ width: "100%" }} format="DD/MM/YYYY" />
      </Form.Item>
      <Form.Item name="dueTime" label="Hora (opcional)">
        <DatePicker.TimePicker size="large" style={{ width: "100%" }} format="HH:mm" />
      </Form.Item>
    </Form>
  );
}
`);

w("web/src/pages/TasksPage.tsx", `import { FolderAddOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Drawer, Empty, Form, Input, List, Segmented, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createProject,
  createTask,
  fetchProjects,
  fetchTasks,
  updateTask,
} from "../api/client";
import { TaskForm, formValuesToPayload, taskToFormValues, type TaskFormValues } from "../features/tasks/TaskForm";
import { TaskItem } from "../features/tasks/TaskItem";
import type { Project, Task, TaskStatus } from "../types";

export function TasksPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "open">("open");
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [taskDrawer, setTaskDrawer] = useState(false);
  const [projectDrawer, setProjectDrawer] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [form] = Form.useForm<TaskFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        fetchProjects(),
        fetchTasks({
          projectId: filter === "all" ? undefined : filter === "inbox" ? "inbox" : filter,
          status: statusFilter === "open" ? undefined : statusFilter,
        }),
      ]);
      setProjects(p);
      setTasks(statusFilter === "open" ? t.filter((x) => x.status !== "DONE") : t);
    } catch {
      message.error("No se pudieron cargar las tareas");
    } finally {
      setLoading(false);
    }
  }, [filter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const segmentOptions = useMemo(
    () => [
      { label: "Todas", value: "all" },
      { label: "Inbox", value: "inbox" },
      ...projects.map((p) => ({ label: p.name, value: p.id })),
    ],
    [projects],
  );

  const handleToggle = async (task: Task) => {
    setTogglingId(task.id);
    try {
      const next: TaskStatus = task.status === "DONE" ? "TODO" : "DONE";
      await updateTask(task.id, { status: next });
      await load();
    } catch {
      message.error("No se pudo actualizar");
    } finally {
      setTogglingId(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue(taskToFormValues(null, filter === "all" || filter === "inbox" ? null : filter));
    setTaskDrawer(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    form.setFieldsValue(taskToFormValues(task));
    setTaskDrawer(true);
  };

  const handleSaveTask = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = formValuesToPayload(values);
      if (editing) {
        await updateTask(editing.id, payload);
        message.success("Tarea actualizada");
      } else {
        await createTask(payload);
        message.success("Tarea creada");
      }
      setTaskDrawer(false);
      await load();
    } catch {
      message.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      await createProject({ name: newProjectName.trim() });
      setNewProjectName("");
      setProjectDrawer(false);
      message.success("Proyecto creado");
      await load();
    } catch {
      message.error("No se pudo crear el proyecto");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>Tareas</Typography.Title>
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<FolderAddOutlined />} onClick={() => setProjectDrawer(true)} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nueva</Button>
        </div>
      </div>

      <Segmented
        block
        value={filter}
        onChange={(v) => setFilter(String(v))}
        options={segmentOptions}
        style={{ marginBottom: 12 }}
      />

      <Segmented
        block
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as TaskStatus | "open")}
        options={[
          { label: "Abiertas", value: "open" },
          { label: "Pendientes", value: "TODO" },
          { label: "En progreso", value: "IN_PROGRESS" },
          { label: "Hechas", value: "DONE" },
        ]}
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <List loading dataSource={[]} />
      ) : tasks.length === 0 ? (
        <Empty description="Sin tareas">
          <Button type="primary" onClick={openCreate}>Crear tarea</Button>
        </Empty>
      ) : (
        <List
          dataSource={tasks}
          renderItem={(task) => (
            <TaskItem task={task} loading={togglingId === task.id} onToggle={handleToggle} onOpen={openEdit} />
          )}
        />
      )}

      <Drawer
        title={editing ? "Editar tarea" : "Nueva tarea"}
        open={taskDrawer}
        onClose={() => setTaskDrawer(false)}
        placement="bottom"
        extra={<Button type="primary" loading={saving} onClick={() => void handleSaveTask()}>Guardar</Button>}
      >
        <TaskForm form={form} projects={projects} initial={editing} />
      </Drawer>

      <Drawer title="Nuevo proyecto" open={projectDrawer} onClose={() => setProjectDrawer(false)} placement="bottom">
        <Input
          size="large"
          placeholder="Nombre del proyecto"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onPressEnter={() => void handleCreateProject()}
        />
        <Button type="primary" block size="large" style={{ marginTop: 16 }} onClick={() => void handleCreateProject()}>
          Crear proyecto
        </Button>
      </Drawer>
    </div>
  );
}
`);

console.log("TaskForm + TasksPage ok");
