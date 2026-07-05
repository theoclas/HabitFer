import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

const typesAppend = `

export type ScheduleType = "DAILY" | "WEEKLY";

export type Habit = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  icon: string | null;
  archived: boolean;
  scheduleType: ScheduleType;
  scheduleDays: number[];
  streakEnabled: boolean;
  reminderEnabled: boolean;
  reminderTime: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  scheduledToday: boolean;
  recentCompletions?: string[];
};

export type HabitToday = Habit & {
  scheduledForDate: string;
};

export type CreateHabitPayload = {
  title: string;
  description?: string;
  color?: string;
  scheduleType?: ScheduleType;
  scheduleDays?: number[];
  streakEnabled?: boolean;
  reminderEnabled?: boolean;
  reminderTime?: string;
};
`;

const typesPath = path.join(root, "web/src/types.ts");
fs.appendFileSync(typesPath, typesAppend, "utf8");

const clientPath = path.join(root, "web/src/api/client.ts");
let client = fs.readFileSync(clientPath, "utf8");
client += `
import type { CreateHabitPayload, Habit, HabitToday } from "../types";

export async function fetchHabits() {
  const { data } = await api.get<Habit[]>("/habits");
  return data;
}

export async function fetchHabitsToday() {
  const { data } = await api.get<HabitToday[]>("/habits/today");
  return data;
}

export async function fetchHabit(id: string) {
  const { data } = await api.get<Habit>("/habits/" + id);
  return data;
}

export async function createHabit(payload: CreateHabitPayload) {
  const { data } = await api.post<Habit>("/habits", payload);
  return data;
}

export async function updateHabit(id: string, payload: Partial<CreateHabitPayload> & { archived?: boolean }) {
  const { data } = await api.patch<Habit>("/habits/" + id, payload);
  return data;
}

export async function deleteHabit(id: string) {
  await api.delete("/habits/" + id);
}

export async function completeHabit(id: string, date?: string) {
  const { data } = await api.post<Habit>("/habits/" + id + "/complete", date ? { date } : {});
  return data;
}

export async function uncompleteHabit(id: string, date: string) {
  const { data } = await api.delete<Habit>("/habits/" + id + "/complete/" + date);
  return data;
}
`;
fs.writeFileSync(clientPath, client, "utf8");

w("web/src/features/habits/HabitForm.tsx", `import { ColorPicker, Form, Input, Select, Switch, TimePicker } from "antd";
import dayjs from "dayjs";
import type { CreateHabitPayload, Habit, ScheduleType } from "../../types";

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
    scheduleType: values.scheduleType,
    scheduleDays: values.scheduleType === "WEEKLY" ? values.scheduleDays : [1, 2, 3, 4, 5, 6, 7],
    streakEnabled: values.streakEnabled,
    reminderEnabled: values.reminderEnabled,
    reminderTime: values.reminderEnabled && values.reminderTime ? values.reminderTime.format("HH:mm") : undefined,
  };
}

export function HabitForm({ form, initial }: Props) {
  const scheduleType = Form.useWatch("scheduleType", form);

  return (
    <Form form={form} layout="vertical" initialValues={habitToFormValues(initial)}>
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
`);

console.log("web types + form ok");
