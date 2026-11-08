import { Button, Input, InputNumber, Segmented, message } from "antd";
import { useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { createFood } from "../api";
import type { FoodResult } from "../types";

type Props = { initialName: string; onCancel: () => void; onCreated: (food: FoodResult) => void };

type Num = number | null;

/** Alimento propio: lo que dice el empaque o lo que tú sepas, por porción o por 100 g. */
export function CreateFoodForm({ initialName, onCancel, onCreated }: Props) {
  const [name, setName] = useState(initialName.trim());
  const [per, setPer] = useState<"portion" | "100g">("portion");
  const [portionLabel, setPortionLabel] = useState("");
  const [portionGrams, setPortionGrams] = useState<Num>(null);
  const [kcal, setKcal] = useState<Num>(null);
  const [protein, setProtein] = useState<Num>(null);
  const [carbs, setCarbs] = useState<Num>(null);
  const [fat, setFat] = useState<Num>(null);
  const [busy, setBusy] = useState(false);

  const valid = name.trim().length >= 2 && kcal != null && (per === "100g" || portionLabel.trim().length > 0);

  const save = async () => {
    if (!valid || kcal == null) return;
    setBusy(true);
    try {
      const food = await createFood({
        name: name.trim(),
        kcal,
        protein: protein ?? 0,
        carbs: carbs ?? 0,
        fat: fat ?? 0,
        ...(per === "portion" ? { portionLabel: portionLabel.trim(), portionGrams: portionGrams ?? undefined } : {}),
      });
      message.success("Alimento creado");
      onCreated(food);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo crear el alimento"));
    } finally {
      setBusy(false);
    }
  };

  const num = (id: string, label: string, value: Num, set: (v: Num) => void, unit: string, max = 1000) => (
    <div className="nf-field">
      <label className="nf-label" htmlFor={id}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <InputNumber id={id} min={0} max={max} value={value} inputMode="decimal" onChange={(v) => set(typeof v === "number" ? v : null)} style={{ width: "100%" }} />
        <span className="nf-hint">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="nf-detail">
      <button type="button" className="nf-back" onClick={onCancel}>
        ‹ Volver a la búsqueda
      </button>
      <h3 className="nf-detail__name">Crear un alimento</h3>
      <div className="nf-field">
        <label className="nf-label" htmlFor="nf-food-name">
          Nombre
        </label>
        <Input id="nf-food-name" size="large" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Por ejemplo: Galletas Festival" />
      </div>
      <div className="nf-field">
        <span className="nf-label">Los valores son por</span>
        <Segmented
          block
          value={per}
          onChange={(v) => setPer(v as "portion" | "100g")}
          options={[
            { label: "Una porción", value: "portion" },
            { label: "100 g", value: "100g" },
          ]}
        />
      </div>
      {per === "portion" && (
        <div className="nf-grid-2">
          <div className="nf-field">
            <label className="nf-label" htmlFor="nf-portion-label">
              Porción
            </label>
            <Input id="nf-portion-label" value={portionLabel} maxLength={60} onChange={(e) => setPortionLabel(e.target.value)} placeholder="paquete, unidad, vaso" />
          </div>
          {num("nf-portion-grams", "Peso de la porción (si lo sabes)", portionGrams, setPortionGrams, "g", 5000)}
        </div>
      )}
      <div className="nf-grid-2">
        {num("nf-kcal", "Calorías", kcal, setKcal, "kcal", 5000)}
        {num("nf-protein", "Proteína", protein, setProtein, "g")}
        {num("nf-carbs", "Carbohidratos", carbs, setCarbs, "g")}
        {num("nf-fat", "Grasa", fat, setFat, "g")}
      </div>
      <p className="nf-hint" style={{ margin: 0 }}>
        Los encuentras en la tabla nutricional del empaque. Si no sabes los macros, deja solo las calorías.
      </p>
      <div className="nf-actions">
        <Button size="large" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="primary" size="large" loading={busy} disabled={!valid} onClick={() => void save()}>
          Crear y elegir cantidad
        </Button>
      </div>
    </div>
  );
}
