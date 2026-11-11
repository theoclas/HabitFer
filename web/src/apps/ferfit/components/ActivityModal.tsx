import { Input, InputNumber, Modal, message } from "antd";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { saveWorkout } from "../api";

type Props = {
  open: boolean;
  date: string;
  dayText: string;
  activities: { key: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
};

/** Anotar otra actividad (caminar, bici, fútbol…): también cuenta para la racha. */
export function ActivityModal({ open, date, dayText, activities, onClose, onSaved }: Props) {
  const [activity, setActivity] = useState("caminar");
  const [minutes, setMinutes] = useState<number | null>(30);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setActivity("caminar");
      setMinutes(30);
      setName("");
    }
  }, [open]);

  const save = async () => {
    if (!minutes || minutes < 1) {
      message.warning("Di cuántos minutos fueron.");
      return;
    }
    setBusy(true);
    try {
      await saveWorkout({ date, kind: "ACTIVITY", activity, minutes, name: activity === "otra" ? name.trim() || undefined : undefined });
      message.success("Anotado: cuenta para tu racha.");
      onSaved();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo anotar"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={`Otra actividad · ${dayText}`} okText="Anotar" cancelText="Cancelar" onOk={() => void save()} confirmLoading={busy} onCancel={onClose}>
      <div className="fit-editor" style={{ gap: 14 }}>
        <div className="fit-field">
          <span className="fit-label" id="fit-act-label">
            ¿Qué hiciste?
          </span>
          <div className="fit-actgrid" role="group" aria-labelledby="fit-act-label">
            {activities.map((a) => (
              <button key={a.key} type="button" className="fit-chip" aria-pressed={activity === a.key} onClick={() => setActivity(a.key)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
        {activity === "otra" && (
          <div className="fit-field">
            <label className="fit-label" htmlFor="fit-act-name">
              Nombre
            </label>
            <Input id="fit-act-name" maxLength={80} placeholder="Por ejemplo: tenis, patinar, subir escaleras" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="fit-field">
          <label className="fit-label" htmlFor="fit-act-min">
            Minutos
          </label>
          <InputNumber id="fit-act-min" min={1} max={600} value={minutes} onChange={(v) => setMinutes(typeof v === "number" ? v : null)} style={{ width: 140 }} />
        </div>
      </div>
    </Modal>
  );
}
