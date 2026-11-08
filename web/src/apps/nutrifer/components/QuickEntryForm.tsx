import { Button, Input, InputNumber } from "antd";
import { useState, type ReactNode } from "react";
import type { QuickInput } from "../api";

type Props = {
  /** Para editar un registro rápido: lo que ya tenía. */
  initial?: QuickInput;
  busy: boolean;
  submitLabel: (kcal: number) => string;
  onSubmit: (value: QuickInput) => void;
  onCancel?: () => void;
  /** Controles extra arriba del botón (mover de comida, borrar). */
  children?: ReactNode;
};

type Num = number | null;

/** Registro rápido: solo las calorías (y los macros si se saben), para cuando no hay tiempo de buscar. */
export function QuickEntryForm({ initial, busy, submitLabel, onSubmit, onCancel, children }: Props) {
  const [kcal, setKcal] = useState<Num>(initial?.kcal ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [protein, setProtein] = useState<Num>(initial?.protein ?? null);
  const [carbs, setCarbs] = useState<Num>(initial?.carbs ?? null);
  const [fat, setFat] = useState<Num>(initial?.fat ?? null);
  const valid = kcal != null && kcal >= 1 && kcal <= 10000;

  const submit = () => {
    if (!valid || kcal == null) return;
    onSubmit({
      kcal: Math.round(kcal),
      name: name.trim() || undefined,
      protein: protein ?? 0,
      carbs: carbs ?? 0,
      fat: fat ?? 0,
    });
  };

  const macro = (id: string, label: string, value: Num, set: (v: Num) => void) => (
    <div className="nf-field">
      <label className="nf-label" htmlFor={id}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <InputNumber id={id} min={0} max={1000} value={value} inputMode="decimal" onChange={(v) => set(typeof v === "number" ? v : null)} style={{ width: "100%" }} />
        <span className="nf-hint">g</span>
      </div>
    </div>
  );

  return (
    <div className="nf-detail">
      {onCancel && (
        <button type="button" className="nf-back" onClick={onCancel}>
          ‹ Volver a la búsqueda
        </button>
      )}
      {!initial && (
        <header>
          <h3 className="nf-detail__name">Solo calorías</h3>
          <p className="nf-detail__source">Para cuando no hay tiempo de buscar. Los macros son opcionales.</p>
        </header>
      )}
      <div className="nf-field">
        <label className="nf-label" htmlFor="nf-quick-kcal">
          Calorías
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <InputNumber
            id="nf-quick-kcal"
            size="large"
            min={1}
            max={10000}
            value={kcal}
            inputMode="numeric"
            autoFocus={!initial}
            placeholder="350"
            onChange={(v) => setKcal(typeof v === "number" ? v : null)}
            onPressEnter={submit}
            style={{ width: 160 }}
          />
          <span className="nf-hint">kcal</span>
        </div>
      </div>
      <div className="nf-field">
        <label className="nf-label" htmlFor="nf-quick-name">
          ¿Qué fue? <small className="nf-hint">(opcional)</small>
        </label>
        <Input id="nf-quick-name" size="large" maxLength={80} value={name} placeholder="Empanada de la esquina" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="nf-grid-3">
        {macro("nf-quick-protein", "Proteína", protein, setProtein)}
        {macro("nf-quick-carbs", "Carbohidratos", carbs, setCarbs)}
        {macro("nf-quick-fat", "Grasa", fat, setFat)}
      </div>
      {children}
      <div className="nf-actions">
        {onCancel && (
          <Button size="large" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="primary" size="large" loading={busy} disabled={!valid} onClick={submit}>
          {submitLabel(kcal ?? 0)}
        </Button>
      </div>
    </div>
  );
}
