import { Input, Modal, message } from "antd";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { createSavedMeal } from "../api";
import { thingsText } from "../format";
import type { MealSlot } from "../types";

export type SaveSource = { date: string; meal: MealSlot; mealName: string; count: number };

type Props = { source: SaveSource | null; onClose: () => void; onSaved: (name: string) => void };

/** Guardar lo de una comida con un nombre («Mi desayuno de semana») para anotarlo después de un toque. */
export function SaveMealModal({ source, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (source) setName(`Mi ${source.mealName.toLowerCase()}`);
  }, [source]);

  if (!source) return null;
  const valid = name.trim().length > 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const saved = await createSavedMeal({ name: name.trim(), date: source.date, meal: source.meal });
      onSaved(saved.name);
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="Guardar como comida"
      okText="Guardar"
      cancelText="Cancelar"
      confirmLoading={busy}
      okButtonProps={{ disabled: !valid }}
      onOk={() => void submit()}
      onCancel={onClose}
      rootClassName="nf-drawer"
      centered
    >
      <div className="nf-detail" style={{ gap: 12 }}>
        <div className="nf-field">
          <label className="nf-label" htmlFor="nf-saved-name">
            Nombre
          </label>
          <Input
            id="nf-saved-name"
            size="large"
            maxLength={80}
            value={name}
            placeholder="Mi desayuno de semana"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onPressEnter={() => void submit()}
          />
        </div>
        <p className="nf-hint" style={{ margin: 0 }}>
          Guarda {thingsText(source.count)} de {source.mealName.toLowerCase()}. Después la anotas completa desde «Agregar», con un toque.
        </p>
      </div>
    </Modal>
  );
}
