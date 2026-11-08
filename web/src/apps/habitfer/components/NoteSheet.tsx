import { Button, Input, Modal, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { completeHabit } from "../../../api/client";
import { habitEmoji } from "../../../features/habits/habitUtils";
import type { CompleteHabitResponse } from "../../../types";

type NoteTarget = { id: string; title: string; icon: string | null; color: string };

type Props = {
  open: boolean;
  habit: NoteTarget | null;
  date: string;
  initialNote: string | null;
  /** Si el habito aun no esta hecho ese dia, guardar la nota tambien lo marca. */
  completed: boolean;
  onClose: () => void;
  onSaved: (result: CompleteHabitResponse, note: string | null) => void;
};

/** Nota del dia para un habito (se abre manteniendo presionada la tarjeta). */
export function NoteSheet({ open, habit, date, initialNote, completed, onClose, onSaved }: Props) {
  const [text, setText] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setText(initialNote ?? "");
  }, [open, initialNote]);

  if (!habit) return null;
  const isToday = date === dayjs().format("YYYY-MM-DD");

  const save = async () => {
    setSaving(true);
    try {
      const clean = text.trim();
      const result = await completeHabit(habit.id, date, clean);
      onSaved(result, clean || null);
      message.success(clean ? "Nota guardada" : "Nota borrada");
      onClose();
    } catch {
      message.error("No se pudo guardar la nota");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      width={440}
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden="true" style={{ fontSize: 22 }}>
            {habitEmoji(habit.icon)}
          </span>
          <span>
            {habit.title}
            <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--hf-muted)" }}>
              Nota de {isToday ? "hoy" : dayjs(date).format("dddd D [de] MMMM")}
            </span>
          </span>
        </span>
      }
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancelar
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={() => void save()}>
          {completed ? "Guardar nota" : "Guardar y marcar"}
        </Button>,
      ]}
    >
      <Input.TextArea
        id="hf-note-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={300}
        showCount
        autoSize={{ minRows: 3, maxRows: 7 }}
        placeholder="¿Cómo te fue? Ej.: con lluvia de fondo salió solo."
        autoFocus
        onPressEnter={(e) => {
          if (e.ctrlKey || e.metaKey) void save();
        }}
      />
      {!completed && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--hf-muted)" }}>Guardar la nota también marca el hábito como hecho.</p>}
    </Modal>
  );
}
