import { Button, Form, Modal, message } from "antd";
import { useEffect, useState } from "react";
import { createHabit, updateHabit } from "../api/client";
import { apiErrorMessage } from "../apps/habitfer/format";
import { FormDrawer } from "./FormDrawer";
import { HabitForm, formValuesToPayload, habitToFormValues, type HabitFormValues } from "../features/habits/HabitForm";
import { TemplatePicker } from "../features/habits/TemplatePicker";
import { TEMPLATE_PACKS } from "../features/habits/templates";
import type { Habit } from "../types";

type Props = {
  open: boolean;
  habit: Habit | null;
  onClose: () => void;
  onSaved: () => void;
};

export function HabitEditorDrawer({ open, habit, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<HabitFormValues>();
  const [packId, setPackId] = useState<string | null>(null);
  const isEdit = habit !== null;

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(habitToFormValues(habit));
    }
  }, [open, habit, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = formValuesToPayload(values);
      if (isEdit) {
        await updateHabit(habit.id, payload);
        message.success("Habito actualizado");
      } else {
        await createHabit(payload);
        message.success("Habito creado");
      }
      onClose();
      onSaved();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = () => {
    if (!habit) return;
    Modal.confirm({
      title: "Archivar habito?",
      content: "Deja de aparecer en tus listas, pero su historial queda. Lo puedes restaurar desde Hábitos → Archivados.",
      okText: "Archivar",
      cancelText: "Cancelar",
      onOk: async () => {
        await updateHabit(habit.id, { archived: true });
        message.success("Habito archivado");
        onClose();
        onSaved();
      },
    });
  };

  return (
    <FormDrawer
      title={isEdit ? "Editar habito" : "Nuevo habito"}
      open={open}
      onClose={onClose}
      extra={
        <Button type="primary" loading={saving} onClick={() => void handleSave()}>
          Guardar
        </Button>
      }
    >
      {!isEdit && (
        <div className="hf-template-strip">
          <span>¿Sin ideas? Empieza con una plantilla</span>
          <div className="hf-template-strip__row">
            {TEMPLATE_PACKS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPackId(p.id)}>
                <span aria-hidden="true">{p.emoji}</span> {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <HabitForm form={form} initial={habit} />
      {isEdit && (
        <Button danger block style={{ marginTop: 16 }} onClick={handleArchive}>
          Archivar
        </Button>
      )}
      <TemplatePicker
        open={packId !== null}
        packId={packId}
        onClose={() => setPackId(null)}
        onCreated={() => {
          onClose();
          onSaved();
        }}
      />
    </FormDrawer>
  );
}
