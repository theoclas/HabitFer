import { Button, Form, Modal, message } from "antd";
import { useEffect, useState } from "react";
import { createHabit, updateHabit } from "../api/client";
import { FormDrawer } from "./FormDrawer";
import { HabitForm, formValuesToPayload, habitToFormValues, type HabitFormValues } from "../features/habits/HabitForm";
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
  const isEdit = habit !== null;

  useEffect(() => {
    if (open) {
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
    } catch {
      message.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = () => {
    if (!habit) return;
    Modal.confirm({
      title: "Archivar habito?",
      content: "Dejara de aparecer en tus listas diarias.",
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
        <Button
          type="primary"
          loading={saving}
          onClick={() => void handleSave()}
          style={{ background: "#2dd4bf", borderColor: "#2dd4bf", color: "#0a0a0f" }}
        >
          Guardar
        </Button>
      }
    >
      <HabitForm form={form} initial={habit} />
      {isEdit && (
        <Button danger block style={{ marginTop: 16 }} onClick={handleArchive}>
          Archivar
        </Button>
      )}
    </FormDrawer>
  );
}
