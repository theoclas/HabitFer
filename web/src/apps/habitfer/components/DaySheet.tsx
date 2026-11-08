import { CaretRightOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Input, Modal, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState, type CSSProperties } from "react";
import { completeHabit, freezeHabitDay, setHabitProgress, unfreezeHabitDay } from "../../../api/client";
import { habitEmoji, isMeasurable, unitFor } from "../../../features/habits/habitUtils";
import type { CompleteHabitResponse, FreezeBalance, Habit, HabitToday } from "../../../types";
import { buzz } from "../effects";
import { canFocus, startFocus } from "../focus";
import { apiErrorMessage } from "../format";

type Props = {
  open: boolean;
  habit: Habit | HabitToday | null;
  date: string;
  /** Congeladores disponibles (null si no se sabe). */
  freezesAvailable: number | null;
  onClose: () => void;
  /** Se guardo la cantidad o la nota. */
  onSaved: (result: CompleteHabitResponse) => void;
  /** Se congelo o descongelo el dia. */
  onFreezeChange?: (balance: FreezeBalance, habit: Habit) => void;
};

const FREEZE_WINDOW_DAYS = 7;

/**
 * El dia de un habito: cantidad (medibles), nota y congelador.
 * Se abre manteniendo presionada la tarjeta o desde el detalle.
 */
export function DaySheet({ open, habit, date, freezesAvailable, onClose, onSaved, onFreezeChange }: Props) {
  const [text, setText] = useState("");
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [freezing, setFreezing] = useState(false);

  useEffect(() => {
    if (open && habit) {
      setText(habit.note ?? "");
      setValue(habit.valueToday ?? 0);
    }
  }, [open, habit]);

  if (!habit) return null;
  const measurable = isMeasurable(habit);
  const goal = Math.max(1, habit.goal);
  const isToday = date === dayjs().format("YYYY-MM-DD");
  const daysAgo = dayjs().startOf("day").diff(dayjs(date), "day");
  const freezable =
    habit.kind === "BUILD" &&
    habit.scheduleType !== "WEEKLY_COUNT" &&
    habit.streakEnabled &&
    !habit.completedToday &&
    daysAgo >= 0 &&
    daysAgo <= FREEZE_WINDOW_DAYS &&
    (habit.requiredToday || habit.frozenToday);
  const willBeDone = measurable ? value >= goal : true;

  const step = (delta: number) => {
    buzz(6);
    setValue((v) => Math.max(0, v + delta));
  };

  const save = async () => {
    setSaving(true);
    try {
      const clean = text.trim();
      const result = measurable ? await setHabitProgress(habit.id, date, value, clean) : await completeHabit(habit.id, date, clean);
      onSaved(result);
      message.success(measurable ? "Guardado" : clean ? "Nota guardada" : "Nota borrada");
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  };

  const toggleFreeze = async () => {
    setFreezing(true);
    try {
      const res = habit.frozenToday ? await unfreezeHabitDay(habit.id, date) : await freezeHabitDay(habit.id, date);
      message.success(habit.frozenToday ? "Listo: el congelador volvió a tu saldo" : "Día congelado: tu racha está a salvo ❄️");
      onFreezeChange?.(res.freezes, res.habit);
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo congelar ese día"));
    } finally {
      setFreezing(false);
    }
  };

  const unit = habit.unit ?? "";
  const saveLabel = measurable ? "Guardar" : habit.completedToday ? "Guardar nota" : "Guardar y marcar";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      width={440}
      className="hf-day-sheet"
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden="true" style={{ fontSize: 22 }}>
            {habitEmoji(habit.icon)}
          </span>
          <span>
            {habit.title}
            <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--hf-muted)" }}>
              {isToday ? "Hoy" : dayjs(date).format("dddd D [de] MMMM")}
            </span>
          </span>
        </span>
      }
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancelar
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={() => void save()}>
          {saveLabel}
        </Button>,
      ]}
    >
      {measurable && (
        <div className="hf-stepper" style={{ "--c": habit.color } as CSSProperties}>
          <button type="button" aria-label="Restar" onClick={() => step(-Math.max(1, habit.step))} disabled={value <= 0}>
            <MinusOutlined />
          </button>
          <div className="hf-stepper__value" aria-live="polite">
            <b>{value}</b>
            <span>
              de {goal} {unitFor(goal, unit)}
            </span>
            <i className="hf-stepper__bar" aria-hidden="true">
              <em style={{ width: `${Math.min(100, Math.round((value / goal) * 100))}%` }} />
            </i>
          </div>
          <button type="button" aria-label="Sumar" onClick={() => step(Math.max(1, habit.step))}>
            <PlusOutlined />
          </button>
        </div>
      )}
      {measurable && (
        <div className="hf-stepper__quick">
          <button type="button" onClick={() => setValue(goal)} disabled={value === goal}>
            Llegar a la meta
          </button>
          <button type="button" onClick={() => setValue(0)} disabled={value === 0}>
            Poner en 0
          </button>
          {isToday && canFocus(habit) && (
            <button
              type="button"
              className="is-focus"
              onClick={() => {
                onClose();
                startFocus(habit);
              }}
            >
              <CaretRightOutlined /> Enfoque
            </button>
          )}
        </div>
      )}

      <Input.TextArea
        id="hf-note-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={300}
        showCount
        autoSize={{ minRows: 2, maxRows: 6 }}
        placeholder="¿Cómo te fue? Ej.: con lluvia de fondo salió solo."
        autoFocus={!measurable}
        onPressEnter={(e) => {
          if (e.ctrlKey || e.metaKey) void save();
        }}
      />
      {!measurable && !habit.completedToday && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--hf-muted)" }}>Guardar la nota también marca el hábito como hecho.</p>
      )}
      {measurable && !willBeDone && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--hf-muted)" }}>
          Se marca como hecho al llegar a {goal} {unitFor(goal, unit)}.
        </p>
      )}

      {freezable && (
        <div className={`hf-freeze-row${habit.frozenToday ? " is-on" : ""}`}>
          <span aria-hidden="true">❄️</span>
          <div>
            <b>{habit.frozenToday ? "Este día está congelado" : "¿No vas a poder hoy?"}</b>
            <span>
              {habit.frozenToday
                ? "No rompe tu racha. Si al final lo haces, el congelador vuelve solo."
                : freezesAvailable === null
                  ? "Un congelador guarda tu racha ese día."
                  : freezesAvailable > 0
                    ? `Un congelador guarda tu racha ese día. Te quedan ${freezesAvailable}.`
                    : "No te quedan congeladores: ganas uno cada vez que subes de nivel."}
            </span>
          </div>
          <Button
            size="small"
            loading={freezing}
            disabled={!habit.frozenToday && freezesAvailable === 0}
            onClick={() => void toggleFreeze()}
          >
            {habit.frozenToday ? "Quitar" : "Congelar"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
