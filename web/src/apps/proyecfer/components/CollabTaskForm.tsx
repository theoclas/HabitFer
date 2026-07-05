import { DatePicker, Form, Input, Select } from "antd";
import type { TaskPriority, TaskStatus } from "../../../types";
import type { WorkspaceUser } from "../../../types/proyecfer";
import dayjs from "dayjs";

export type CollabTaskFormValues = {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  dueDate?: dayjs.Dayjs;
};

type Props = {
  form: ReturnType<typeof Form.useForm<CollabTaskFormValues>>[0];
  members: WorkspaceUser[];
};

export function CollabTaskForm({ form, members }: Props) {
  return (
    <Form form={form} layout="vertical" initialValues={{ status: "TODO", priority: "MEDIUM" }}>
      <Form.Item name="title" label="Titulo" rules={[{ required: true }]}>
        <Input size="large" />
      </Form.Item>
      <Form.Item name="description" label="Descripcion">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item name="assigneeId" label="Asignar a">
        <Select
          allowClear
          placeholder="Seleccionar colaborador"
          options={members.map((m) => ({ value: m.id, label: `${m.fullName} (@${m.username})` }))}
        />
      </Form.Item>
      <Form.Item name="status" label="Estado">
        <Select options={[
          { value: "TODO", label: "Pendiente" },
          { value: "IN_PROGRESS", label: "En progreso" },
          { value: "DONE", label: "Hecha" },
        ]} />
      </Form.Item>
      <Form.Item name="priority" label="Prioridad">
        <Select options={[
          { value: "LOW", label: "Baja" },
          { value: "MEDIUM", label: "Media" },
          { value: "HIGH", label: "Alta" },
        ]} />
      </Form.Item>
      <Form.Item name="dueDate" label="Fecha limite">
        <DatePicker style={{ width: "100%" }} />
      </Form.Item>
    </Form>
  );
}

export function formValuesToCollabTaskPayload(values: CollabTaskFormValues) {
  return {
    title: values.title,
    description: values.description,
    status: values.status,
    priority: values.priority,
    assigneeId: values.assigneeId,
    dueDate: values.dueDate ? values.dueDate.format("YYYY-MM-DD") : undefined,
  };
}
