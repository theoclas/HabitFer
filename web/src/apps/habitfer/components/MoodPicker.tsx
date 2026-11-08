import { message } from "antd";
import { useState } from "react";
import { clearMood, setMood } from "../../../api/client";
import { buzz } from "../effects";
import { MOODS } from "../format";

type Props = {
  date: string;
  value: number | null;
  /** Solo hoy y ayer se pueden registrar; otros dias se ven en modo lectura. */
  editable: boolean;
  onChange: (value: number | null) => void;
};

/** "¿Como va tu dia?": cinco caras al final de Hoy. Se cruza con la constancia en Estadisticas. */
export function MoodPicker({ date, value, editable, onChange }: Props) {
  const [saving, setSaving] = useState(false);
  if (!editable && value === null) return null;

  const pick = async (v: number) => {
    if (!editable || saving) return;
    const before = value;
    const next = v === value ? null : v;
    onChange(next);
    buzz(8);
    setSaving(true);
    try {
      if (next === null) await clearMood(date);
      else await setMood(date, next);
    } catch {
      onChange(before);
      message.error("No se pudo guardar el ánimo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="hf-section hf-mood" aria-label="Ánimo del día">
      <div className="hf-section__head">
        <span>¿Cómo va tu día?</span>
        {value !== null && <span style={{ textTransform: "none", letterSpacing: 0 }}>{MOODS[value - 1].label}</span>}
      </div>
      <div className="hf-mood__row" role="radiogroup" aria-label="Ánimo">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={value === m.value}
            aria-label={m.label}
            className={`hf-mood__btn${value === m.value ? " is-on" : ""}`}
            disabled={!editable}
            onClick={() => void pick(m.value)}
          >
            <span aria-hidden="true">{m.emoji}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
