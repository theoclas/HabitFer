import { Alert, DatePicker, Form, Input, Segmented, Select } from "antd";
import type { TaskPriority, TaskStatus } from "../../../types";
import type { CollabTaskKind, WorkspaceUser } from "../../../types/proyecfer";
import dayjs from "dayjs";

export type CollabTaskFormValues = {
  title: string;
  description?: string;
  kind?: CollabTaskKind;
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
  const kind = Form.useWatch("kind", form) ?? "ONE_OFF";
  const isDaily = kind === "DAILY";

  return (
    <Form form={form} layout="vertical" initialValues={{ kind: "ONE_OFF", status: "TODO", priority: "MEDIUM" }}>
      <Form.Item name="kind" label="Tipo de tarea">
        <Segmented
          options={[
            { label: "Tarea unica", value: "ONE_OFF" },
            { label: "Rutina diaria", value: "DAILY" },
          ]}
        />
      </Form.Item>

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

      {isDaily && (
        <Alert
          type="info"
          showIcon
          message="Rutina diaria"
          description="Cada dia el sistema crea una tarea pendiente automaticamente. Marca 'Hecha' cuando la completes."
          style={{ marginBottom: 16 }}
        />
      )}

      {!isDaily && (
        <>
          <Form.Item name="status" label="Estado">
            <Select
              options={[
                { value: "TODO", label: "Pendiente" },
                { value: "IN_PROGRESS", label: "En progreso" },
                { value: "DONE", label: "Hecha" },
              ]}
            />
          </Form.Item>
          <Form.Item name="priority" label="Prioridad">
            <Select
              options={[
                { value: "LOW", label: "Baja" },
                { value: "MEDIUM", label: "Media" },
                { value: "HIGH", label: "Alta" },
              ]}
            />
          </Form.Item>
          <Form.Item name="dueDate" label="Fecha limite">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </>
      )}

      {isDaily && (
        <Form.Item name="priority" label="Prioridad">
          <Select
            options={[
              { value: "LOW", label: "Baja" },
              { value: "MEDIUM", label: "Media" },
              { value: "HIGH", label: "Alta" },
            ]}
          />
        </Form.Item>
      )}
    </Form>
  );
}

export function formValuesToCollabTaskPayload(values: CollabTaskFormValues) {
  const isDaily = values.kind === "DAILY";
  return {
    title: values.title,
    description: values.description,
    kind: values.kind ?? "ONE_OFF",
    status: isDaily ? "TODO" : values.status,
    priority: values.priority,
    assigneeId: values.assigneeId,
    dueDate: !isDaily && values.dueDate ? values.dueDate.format("YYYY-MM-DD") : undefined,
  };
}
