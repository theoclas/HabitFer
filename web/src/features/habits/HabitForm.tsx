import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { AutoComplete, Button, ColorPicker, DatePicker, Form, Input, InputNumber, Segmented, Select, Switch, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { CreateHabitPayload, Habit, HabitKind, ScheduleType, TimeOfDay } from "../../types";
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

const UNIT_OPTIONS = ["vasos", "minutos", "páginas", "km", "pasos", "veces", "horas", "litros", "series"].map((u) => ({ value: u }));
const CHALLENGE_OPTIONS = [7, 14, 21, 30, 60, 90, 100].map((d) => ({ value: d, label: `${d} días` }));

const MAX_REMINDERS = 4;

export type HabitFormValues = {
  kind: HabitKind;
  title: string;
  description?: string;
  color: string;
  icon?: string | null;
  scheduleType: ScheduleType;
  scheduleDays: number[];
  weeklyTarget: number;
  timeOfDay: TimeOfDay;
  streakEnabled: boolean;
  measurable: boolean;
  goal: number;
  unit?: string;
  step: number;
  /** Dejar algo: primer dia limpio. */
  startDate?: Dayjs;
  challengeOn: boolean;
  challengeDays: number;
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

export function habitToFormValues(habit?: Habit | null, preset?: Partial<HabitFormValues>): HabitFormValues {
  const times = initialTimes(habit);
  const goal = habit?.goal ?? 1;
  const challengeLive = Boolean(habit?.challenge && habit.challenge.status !== "won");
  return {
    kind: habit?.kind ?? "BUILD",
    title: habit?.title ?? "",
    description: habit?.description ?? "",
    color: habit?.color ?? "#22d3ee",
    icon: habit?.icon ?? "✨",
    scheduleType: habit?.scheduleType ?? "DAILY",
    scheduleDays: habit?.scheduleDays ?? [1, 2, 3, 4, 5, 6, 7],
    weeklyTarget: habit?.weeklyTarget ?? 3,
    timeOfDay: habit?.timeOfDay ?? "ANYTIME",
    streakEnabled: habit?.streakEnabled ?? true,
    measurable: goal > 1,
    goal: goal > 1 ? goal : 8,
    unit: habit?.unit ?? "",
    step: habit?.step ?? 1,
    startDate: habit?.startDate ? dayjs(habit.startDate) : dayjs(),
    challengeOn: challengeLive,
    challengeDays: habit?.challenge?.days ?? 30,
    reminderEnabled: habit?.reminderEnabled ?? false,
    reminderTimes: times.length ? times : [undefined],
    ...preset,
  };
}

export function formValuesToPayload(values: HabitFormValues): CreateHabitPayload {
  const quit = values.kind === "QUIT";
  const times =
    !quit && values.reminderEnabled
      ? [...new Set((values.reminderTimes ?? []).filter((t): t is dayjs.Dayjs => Boolean(t)).map((t) => t.format("HH:mm")))].sort()
      : [];
  const measurable = !quit && values.measurable && values.goal > 1;
  const scheduleType: ScheduleType = quit ? "DAILY" : values.scheduleType;
  return {
    kind: values.kind,
    title: values.title,
    description: values.description,
    color: typeof values.color === "string" ? values.color : (values.color as { toHexString?: () => string })?.toHexString?.() ?? "#22d3ee",
    icon: values.icon || null,
    scheduleType,
    scheduleDays: scheduleType === "WEEKLY" ? values.scheduleDays : [1, 2, 3, 4, 5, 6, 7],
    weeklyTarget: scheduleType === "WEEKLY_COUNT" ? values.weeklyTarget : undefined,
    timeOfDay: values.timeOfDay ?? "ANYTIME",
    streakEnabled: quit ? true : values.streakEnabled,
    goal: measurable ? values.goal : 1,
    unit: measurable ? values.unit?.trim() || null : null,
    step: measurable ? Math.min(Math.max(1, values.step || 1), values.goal) : 1,
    startDate: quit ? (values.startDate ?? dayjs()).format("YYYY-MM-DD") : undefined,
    challengeDays: values.challengeOn ? values.challengeDays : null,
    reminderEnabled: !quit && values.reminderEnabled && times.length > 0,
    reminderTime: times[0],
    reminderTimes: times,
  };
}

export function HabitForm({ form, initial }: Props) {
  const kind = Form.useWatch("kind", form) ?? "BUILD";
  const scheduleType = Form.useWatch("scheduleType", form);
  const icon = Form.useWatch("icon", form);
  const reminderEnabled = Form.useWatch("reminderEnabled", form);
  const measurable = Form.useWatch("measurable", form);
  const goal = Form.useWatch("goal", form) ?? 8;
  const unit = Form.useWatch("unit", form);
  const challengeOn = Form.useWatch("challengeOn", form);
  const quit = kind === "QUIT";
  const isEdit = Boolean(initial);
  const challenge = initial?.challenge;

  return (
    <Form form={form} layout="vertical" initialValues={habitToFormValues(initial)}>
      {isEdit ? (
        quit && (
          <p className="hf-form-note">
            Hábito para <b>dejar algo</b>: cuenta tus días limpio y registras las recaídas.
          </p>
        )
      ) : (
        <Form.Item name="kind" label="¿Qué quieres?">
          <Segmented
            block
            options={[
              { value: "BUILD", label: "Hacer algo" },
              { value: "QUIT", label: "Dejar algo" },
            ]}
          />
        </Form.Item>
      )}
      <Form.Item name="icon" label="Emoticon">
        <EmojiPicker value={icon} onChange={(emoji) => form.setFieldValue("icon", emoji)} />
      </Form.Item>
      <Form.Item name="title" label="Titulo" rules={[{ required: true, message: "Escribe un titulo" }]}>
        <Input size="large" placeholder={quit ? "Ej. No fumar" : "Ej. Beber agua"} />
      </Form.Item>
      <Form.Item name="description" label="Descripcion">
        <Input.TextArea rows={2} placeholder="Opcional" />
      </Form.Item>
      <Form.Item name="color" label="Color" getValueFromEvent={(c) => (typeof c === "string" ? c : c.toHexString())}>
        <ColorPicker showText format="hex" />
      </Form.Item>

      {quit ? (
        <Form.Item
          name="startDate"
          label="Primer día limpio"
          extra="Si ya llevas días sin hacerlo, pon desde cuándo: la cuenta arranca ahí."
          rules={[{ required: true, message: "Elige el día" }]}
        >
          <DatePicker
            size="large"
            style={{ width: "100%" }}
            format="D [de] MMMM YYYY"
            inputReadOnly
            allowClear={false}
            disabledDate={(d) => d.isAfter(dayjs(), "day") || d.isBefore(dayjs().subtract(10, "year"))}
          />
        </Form.Item>
      ) : (
        <>
          <Form.Item name="scheduleType" label="Frecuencia">
            <Select
              size="large"
              options={[
                { value: "DAILY", label: "Todos los dias" },
                { value: "WEEKLY", label: "Dias especificos" },
                { value: "WEEKLY_COUNT", label: "Unas veces por semana" },
              ]}
            />
          </Form.Item>
          {scheduleType === "WEEKLY" && (
            <Form.Item name="scheduleDays" label="Dias activos" rules={[{ required: true, message: "Elige al menos un dia" }]}>
              <Select mode="multiple" size="large" options={DAY_OPTIONS} />
            </Form.Item>
          )}
          {scheduleType === "WEEKLY_COUNT" && (
            <Form.Item
              name="weeklyTarget"
              label="Veces por semana"
              extra="El día que quieras. La racha cuenta semanas cumplidas."
              rules={[{ required: true, message: "¿Cuántas veces?" }]}
            >
              <InputNumber size="large" min={1} max={7} style={{ width: "100%" }} addonAfter="por semana" />
            </Form.Item>
          )}
          <Form.Item name="timeOfDay" label="Momento del día" extra="En Hoy se agrupa en Mañana, Tarde o Noche, con el momento actual primero.">
            <Segmented block options={TIME_OF_DAY_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="measurable"
            label="Medir cantidad"
            valuePropName="checked"
            extra={measurable ? "Cada toque suma; se marca como hecho al llegar a la meta. Mantén presionado para escribir la cantidad." : "Para metas como 8 vasos, 30 minutos o 10 páginas."}
          >
            <Switch />
          </Form.Item>
          {measurable && (
            <div className="hf-form-row">
              <Form.Item name="goal" label="Meta del día" rules={[{ required: true, message: "¿Cuánto?" }]}>
                <InputNumber size="large" min={2} max={100000} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="unit" label="Unidad">
                <AutoComplete size="large" options={UNIT_OPTIONS} placeholder="vasos" maxLength={20} />
              </Form.Item>
              <Form.Item name="step" label="Cada toque suma" rules={[{ required: true, message: "¿Cuánto?" }]}>
                <InputNumber size="large" min={1} max={Math.max(1, goal)} style={{ width: "100%" }} addonAfter={unit || undefined} />
              </Form.Item>
            </div>
          )}

          <Form.Item name="streakEnabled" label="Contar racha" valuePropName="checked">
            <Switch />
          </Form.Item>
        </>
      )}

      <Form.Item
        name="challengeOn"
        label="Convertirlo en reto"
        valuePropName="checked"
        extra={
          challengeOn
            ? quit
              ? "Ni una recaída en todo el reto. Al terminar ganas una medalla especial."
              : scheduleType === "WEEKLY_COUNT"
                ? "Junta las veces de todas esas semanas. Al terminar ganas una medalla especial."
                : "Cumplir cada día que toca (las pausas y los congeladores cuentan a favor). Al terminar ganas una medalla especial."
            : "Una meta con fecha final: barra de avance, cuenta regresiva y medalla."
        }
      >
        <Switch />
      </Form.Item>
      {challengeOn && (
        <Form.Item name="challengeDays" label="Duración del reto">
          <Select size="large" options={CHALLENGE_OPTIONS} />
        </Form.Item>
      )}
      {challengeOn && challenge && challenge.status !== "won" && (
        <p className="hf-form-note" style={{ marginTop: -8 }}>
          {challenge.status === "broken"
            ? "Este reto se rompió. Desde el detalle del hábito puedes reiniciarlo desde hoy."
            : challenge.status === "upcoming"
              ? `Empieza el ${dayjs(challenge.startKey).format("D [de] MMMM")}.`
              : `Vas en el día ${challenge.dayIndex} de ${challenge.days}.`}
        </p>
      )}

      {!quit && (
        <>
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
        </>
      )}
    </Form>
  );
}
