import { DatePicker, Form, Input, Select, Switch } from "antd";
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
  reminderEnabled: boolean;
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
    reminderEnabled: task?.reminderEnabled ?? false,
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
    reminderEnabled: values.reminderEnabled,
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
      <Form.Item name="reminderEnabled" label="Recordatorio" valuePropName="checked" extra="Te avisara a la hora de la fecha limite">
        <Switch />
      </Form.Item>
    </Form>
  );
}

