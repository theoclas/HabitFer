import { Modal, message } from "antd";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { saveFitSettings } from "../api";
import { fitSettings } from "../hooks";

/** Lo que de verdad cambia qué se puede hacer (la colchoneta y la pared no hacen falta). */
const GEAR: [string, string][] = [
  ["silla", "Silla firme"],
  ["mancuernas", "Mancuernas"],
  ["banda", "Banda elástica"],
  ["escalon", "Escalón o cajón"],
  ["barra", "Barra de puerta"],
];

/** Decir qué hay en casa, para ver solo lo que se puede hacer. */
export function EquipmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = fitSettings.use();
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setSel(settings?.equipment ?? []);
  }, [open, settings]);

  const toggle = (k: string) => setSel((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const save = async () => {
    setBusy(true);
    try {
      fitSettings.set(await saveFitSettings({ equipment: sel }));
      message.success("Listo: ahora ves lo que puedes hacer con eso");
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Lo que tienes en casa" okText="Guardar" cancelText="Cancelar" confirmLoading={busy} onOk={() => void save()} onCancel={onClose}>
      <div className="fit-sheet">
        <span className="fit-hint">Marca lo que tienes. La colchoneta y la pared no hacen falta: sirve el piso o cualquier pared.</span>
        <div className="fit-actgrid fit-actgrid--2" role="group" aria-label="Equipo">
          {GEAR.map(([k, label]) => (
            <button key={k} type="button" className="fit-chip" aria-pressed={sel.includes(k)} onClick={() => toggle(k)}>
              {label}
            </button>
          ))}
        </div>
        <span className="fit-hint">{sel.length ? "Verás los ejercicios con tu peso y con lo que marcaste." : "Nada marcado: verás solo ejercicios con tu propio peso."}</span>
      </div>
    </Modal>
  );
}
