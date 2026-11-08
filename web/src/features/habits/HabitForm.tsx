import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, ColorPicker, Form, Input, Segmented, Select, Switch, TimePicker } from "antd";
import dayjs from "dayjs";
import type { CreateHabitPayload, Habit, ScheduleType, TimeOfDay } from "../../types";
import { EmojiPicker } from "./EmojiPicker";

export const TIME_OF_DAY_OPTIONS: { value: TimeOfDay; label: string }[] = [
  { value: "ANYTIME", label: "Cualquiera" },
  { value: "MORNING", label: "Mañana" },
  { value: "AFTERNOON", label: "Tarde" },
  { value: "EVENING", label: "Noche" },
];

const DAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 7, label: "Dom" },
];

const MAX_REMINDERS = 4;

export type HabitFormValues = {
  title: string;
  description?: string;
  color: string;
  icon?: string | null;
  scheduleType: ScheduleType;
  scheduleDays: number[];
  timeOfDay: TimeOfDay;
  streakEnabled: boolean;
  reminderEnabled: boolean;
  /** Hasta 4 horas de aviso. */
  reminderTimes?: (dayjs.Dayjs | null | undefined)[];
};

type Props = {
  form: ReturnType<typeof Form.useForm<HabitFormValues>>[0];
  initial?: Habit | null;
};

function initialTimes(habit?: Habit | null): dayjs.Dayjs[] {
  const list = habit?.reminderTimes?.length ? habit.reminderTimes : habit?.reminderTime ? [habit.reminderTime] : [];
  return list.map((t) => dayjs(t, "HH:mm"));
}

export function habitToFormValues(habit?: Habit | null): HabitFormValues {
  const times = initialTimes(habit);
  return {
    title: habit?.title ?? "",
    description: habit?.description ?? "",
    color: habit?.color ?? "#22d3ee",
    icon: habit?.icon ?? "✨",
    scheduleType: habit?.scheduleType ?? "DAILY",
    scheduleDays: habit?.scheduleDays ?? [1, 2, 3, 4, 5, 6, 7],
    timeOfDay: habit?.timeOfDay ?? "ANYTIME",
    streakEnabled: habit?.streakEnabled ?? true,
    reminderEnabled: habit?.reminderEnabled ?? false,
    reminderTimes: times.length ? times : [undefined],
  };
}

export function formValuesToPayload(values: HabitFormValues): CreateHabitPayload {
  const times = values.reminderEnabled
    ? [...new Set((values.reminderTimes ?? []).filter((t): t is dayjs.Dayjs => Boolean(t)).map((t) => t.format("HH:mm")))].sort()
    : [];
  return {
    title: values.title,
    description: values.description,
    color: typeof values.color === "string" ? values.color : (values.color as { toHexString?: () => string })?.toHexString?.() ?? "#22d3ee",
    icon: values.icon || null,
    scheduleType: values.scheduleType,
    scheduleDays: values.scheduleType === "WEEKLY" ? values.scheduleDays : [1, 2, 3, 4, 5, 6, 7],
    timeOfDay: values.timeOfDay ?? "ANYTIME",
    streakEnabled: values.streakEnabled,
    reminderEnabled: values.reminderEnabled && times.length > 0,
    reminderTime: times[0],
    reminderTimes: times,
  };
}

export function HabitForm({ form, initial }: Props) {
  const scheduleType = Form.useWatch("scheduleType", form);
  const icon = Form.useWatch("icon", form);
  const reminderEnabled = Form.useWatch("reminderEnabled", form);

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
      <Form.Item name="timeOfDay" label="Momento del día" extra="En Hoy se agrupa en Mañana, Tarde o Noche, con el momento actual primero.">
        <Segmented block options={TIME_OF_DAY_OPTIONS} />
      </Form.Item>
      <Form.Item name="streakEnabled" label="Contar racha" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item
        name="reminderEnabled"
        label="Recordatorio"
        valuePropName="checked"
        extra={reminderEnabled ? "Solo te avisa si a esa hora todavía no lo has hecho." : undefined}
      >
        <Switch />
      </Form.Item>
      {reminderEnabled && (
        <Form.List name="reminderTimes">
          {(fields, { add, remove }) => (
            <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
              {fields.map((field, index) => (
                <div key={field.key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Form.Item
                    {...field}
                    style={{ flex: 1, marginBottom: 0 }}
                    rules={index === 0 ? [{ required: true, message: "Elige una hora" }] : []}
                  >
                    <TimePicker
                      format="HH:mm"
                      size="large"
                      style={{ width: "100%" }}
                      placeholder={index === 0 ? "Hora del aviso" : "Otra hora"}
                      inputReadOnly
                    />
                  </Form.Item>
                  {fields.length > 1 && (
                    <Button size="large" icon={<DeleteOutlined />} aria-label="Quitar esta hora" onClick={() => remove(field.name)} />
                  )}
                </div>
              ))}
              {fields.length < MAX_REMINDERS && (
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add(undefined)}>
                  Agregar otra hora
                </Button>
              )}
            </div>
          )}
        </Form.List>
      )}
    </Form>
  );
}
