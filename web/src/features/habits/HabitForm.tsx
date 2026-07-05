import { ColorPicker, Form, Input, Select, Switch, TimePicker } from "antd";
import dayjs from "dayjs";
import type { CreateHabitPayload, Habit, ScheduleType } from "../../types";
import { EmojiPicker } from "./EmojiPicker";

const DAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 7, label: "Dom" },
];

export type HabitFormValues = {
  title: string;
  description?: string;
  color: string;
  icon?: string | null;
  scheduleType: ScheduleType;
  scheduleDays: number[];
  streakEnabled: boolean;
  reminderEnabled: boolean;
  reminderTime?: dayjs.Dayjs;
};

type Props = {
  form: ReturnType<typeof Form.useForm<HabitFormValues>>[0];
  initial?: Habit | null;
};

export function habitToFormValues(habit?: Habit | null): HabitFormValues {
  return {
    title: habit?.title ?? "",
    description: habit?.description ?? "",
    color: habit?.color ?? "#22d3ee",
    icon: habit?.icon ?? "✨",
    scheduleType: habit?.scheduleType ?? "DAILY",
    scheduleDays: habit?.scheduleDays ?? [1, 2, 3, 4, 5, 6, 7],
    streakEnabled: habit?.streakEnabled ?? true,
    reminderEnabled: habit?.reminderEnabled ?? false,
    reminderTime: habit?.reminderTime ? dayjs(habit.reminderTime, "HH:mm") : undefined,
  };
}

export function formValuesToPayload(values: HabitFormValues): CreateHabitPayload {
  return {
    title: values.title,
    description: values.description,
    color: typeof values.color === "string" ? values.color : (values.color as { toHexString?: () => string })?.toHexString?.() ?? "#22d3ee",
    icon: values.icon || null,
    scheduleType: values.scheduleType,
    scheduleDays: values.scheduleType === "WEEKLY" ? values.scheduleDays : [1, 2, 3, 4, 5, 6, 7],
    streakEnabled: values.streakEnabled,
    reminderEnabled: values.reminderEnabled,
    reminderTime: values.reminderEnabled && values.reminderTime ? values.reminderTime.format("HH:mm") : undefined,
  };
}

export function HabitForm({ form, initial }: Props) {
  const scheduleType = Form.useWatch("scheduleType", form);
  const icon = Form.useWatch("icon", form);

  return (
    <Form form={form} layout="vertical" initialValues={habitToFormValues(initial)}>
      <Form.Item name="icon" label="Emoticon">
        <EmojiPicker value={icon} onChange={(emoji) => form.setFieldValue("icon", emoji)} />
      </Form.Item>
      <Form.Item name="title" label="Titulo" rules={[{ required: true, message: "Escribe un titulo" }]}>
        <Input size="large" placeholder="Ej. Beber agua" />
      </Form.Item>
      <Form.Item name="description" label="Descripcion">
        <Input.TextArea rows={2} placeholder="Opcional" />
      </Form.Item>
      <Form.Item name="color" label="Color" getValueFromEvent={(c) => (typeof c === "string" ? c : c.toHexString())}>
        <ColorPicker showText format="hex" />
      </Form.Item>
      <Form.Item name="scheduleType" label="Frecuencia">
        <Select
          size="large"
          options={[
            { value: "DAILY", label: "Todos los dias" },
            { value: "WEEKLY", label: "Dias especificos" },
          ]}
        />
      </Form.Item>
      {scheduleType === "WEEKLY" && (
        <Form.Item name="scheduleDays" label="Dias activos" rules={[{ required: true, message: "Elige al menos un dia" }]}>
          <Select mode="multiple" size="large" options={DAY_OPTIONS} />
        </Form.Item>
      )}
      <Form.Item name="streakEnabled" label="Contar racha" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item name="reminderEnabled" label="Recordatorio" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(p, c) => p.reminderEnabled !== c.reminderEnabled}>
        {() =>
          form.getFieldValue("reminderEnabled") ? (
            <Form.Item name="reminderTime" label="Hora del recordatorio" rules={[{ required: true }]}>
              <TimePicker format="HH:mm" size="large" style={{ width: "100%" }} />
            </Form.Item>
          ) : null
        }
      </Form.Item>
    </Form>
  );
}
