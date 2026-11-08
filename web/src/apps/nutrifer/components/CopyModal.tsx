import { Modal, message } from "antd";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { copyEntries } from "../api";
import { relativeDay, shiftDay } from "../math";
import type { Entry, MealSlot } from "../types";

export type CopySource = { date: string; meal: MealSlot | null; label: string };

type Props = {
  source: CopySource | null;
  meals: { slot: MealSlot; name: string }[];
  today: string;
  onClose: () => void;
  onCopied: (result: { entries: Entry[]; kcal: number }, where: string) => void;
};

/** Copiar una comida (o el día entero) a otro día, y si se quiere a otra comida. */
export function CopyModal({ source, meals, today, onClose, onCopied }: Props) {
  const [date, setDate] = useState(today);
  const [meal, setMeal] = useState<MealSlot | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!source) return;
    setDate(source.date === today ? shiftDay(today, -1) : today);
    setMeal(source.meal);
  }, [source, today]);

  if (!source) return null;
  const yesterday = shiftDay(today, -1);
  const same = date === source.date && (!source.meal || meal === source.meal);
  const mealName = meals.find((m) => m.slot === meal)?.name ?? "";
  const where = source.meal ? `${mealName}, ${relativeDay(date, today)}` : relativeDay(date, today);

  const submit = async () => {
    if (same) return;
    setBusy(true);
    try {
      const r = await copyEntries({
        fromDate: source.date,
        toDate: date,
        ...(source.meal ? { fromMeal: source.meal, ...(meal && meal !== source.meal ? { toMeal: meal } : {}) } : {}),
      });
      onCopied(r, where);
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo copiar"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={`Copiar ${source.label}`}
      okText="Copiar"
      cancelText="Cancelar"
      confirmLoading={busy}
      okButtonProps={{ disabled: same || !date }}
      onOk={() => void submit()}
      onCancel={onClose}
      rootClassName="nf-drawer"
      centered
    >
      <div className="nf-detail" style={{ gap: 14 }}>
        <div className="nf-field">
          <span className="nf-label" id="nf-copy-day">
            ¿A qué día?
          </span>
          <div className="nf-chips nf-chips--sm" role="group" aria-labelledby="nf-copy-day">
            {[today, yesterday].map((d) => (
              <button key={d} type="button" className="nf-chip" aria-pressed={date === d} onClick={() => setDate(d)}>
                {relativeDay(d, today) === "hoy" ? "Hoy" : "Ayer"}
              </button>
            ))}
            <input
              type="date"
              className="nf-date"
              aria-label="Otro día"
              max={today}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
        </div>
        {source.meal && (
          <div className="nf-field">
            <span className="nf-label" id="nf-copy-meal">
              ¿A qué comida?
            </span>
            <div className="nf-chips nf-chips--sm" role="group" aria-labelledby="nf-copy-meal">
              {meals.map((m) => (
                <button key={m.slot} type="button" className="nf-chip" aria-pressed={meal === m.slot} onClick={() => setMeal(m.slot)}>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="nf-hint" style={{ margin: 0 }}>
          {same ? "Elige otro día u otra comida." : `Se suma a lo que ya tengas anotado ahí (${where}).`}
        </p>
      </div>
    </Modal>
  );
}
