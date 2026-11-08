import { Button, DatePicker, Input, Modal, Segmented, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { createPause } from "../../../api/client";
import { habitEmoji } from "../../../features/habits/habitUtils";
import { notifyHabitsChanged } from "../effects";
import { apiErrorMessage } from "../format";

type Props = {
  open: boolean;
  /** Si viene, se puede pausar solo este habito; si no, la pausa es de todos. */
  habit?: { id: string; title: string; icon: string | null } | null;
  onClose: () => void;
  onCreated?: () => void;
};

const MAX_DAYS = 90;
const PRESETS: { label: string; days: number }[] = [
  { label: "Hoy", days: 1 },
  { label: "3 días", days: 3 },
  { label: "1 semana", days: 7 },
  { label: "2 semanas", days: 14 },
];

/** Pausa (vacaciones, enfermedad): esos dias no se pide nada y las rachas no se rompen. */
export function PauseSheet({ open, habit, onClose, onCreated }: Props) {
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs(), dayjs().add(6, "day")]);
  const [note, setNote] = useState("");
  const [scope, setScope] = useState<"all" | "one">(habit ? "one" : "all");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRange([dayjs(), dayjs().add(6, "day")]);
    setNote("");
    setScope(habit ? "one" : "all");
  }, [open, habit]);

  const days = range[1].diff(range[0], "day") + 1;

  const save = async () => {
    setSaving(true);
    try {
      await createPause({
        habitId: scope === "one" && habit ? habit.id : undefined,
        startDate: range[0].format("YYYY-MM-DD"),
        endDate: range[1].format("YYYY-MM-DD"),
        note: note.trim() || undefined,
      });
      message.success(scope === "one" && habit ? `${habit.title} en pausa` : "Pausa activada: tus rachas están a salvo 🌴");
      notifyHabitsChanged();
      onCreated?.();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo crear la pausa"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      width={460}
      title="Pausar"
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancelar
        </Button>,
        <Button key="ok" type="primary" loading={saving} disabled={days > MAX_DAYS} onClick={() => void save()}>
          {days === 1 ? "Pausar 1 día" : `Pausar ${days} días`}
        </Button>,
      ]}
    >
      <p className="hf-hint" style={{ marginTop: 0 }}>
        Vacaciones, un viaje o estás enfermo: durante la pausa nada se pide y tus rachas no se rompen. Si igual haces algo, cuenta.
      </p>
      {habit && (
        <Segmented
          block
          value={scope}
          onChange={(v) => setScope(v as "all" | "one")}
          options={[
            { value: "one", label: `${habitEmoji(habit.icon)} Solo ${habit.title}` },
            { value: "all", label: "Todos los hábitos" },
          ]}
          style={{ marginBottom: 14 }}
        />
      )}
      <div className="hf-pause-presets">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => setRange([dayjs(), dayjs().add(p.days - 1, "day")])} className={days === p.days && range[0].isSame(dayjs(), "day") ? "is-on" : ""}>
            {p.label}
          </button>
        ))}
      </div>
      <DatePicker.RangePicker
        value={range}
        onChange={(v) => {
          if (v?.[0] && v[1]) setRange([v[0], v[1]]);
        }}
        format="D MMM YYYY"
        allowClear={false}
        inputReadOnly
        style={{ width: "100%", margin: "12px 0" }}
        disabledDate={(d) => d.isBefore(dayjs().subtract(7, "day"), "day") || d.isAfter(dayjs().add(365, "day"), "day")}
      />
      {days > MAX_DAYS && <p style={{ color: "var(--hf-ember)", margin: "-4px 0 10px" }}>Una pausa dura como máximo {MAX_DAYS} días.</p>}
      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Motivo (opcional): Viaje a la costa" />
    </Modal>
  );
}
