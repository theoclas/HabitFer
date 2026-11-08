import { BarcodeOutlined, DownOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Button, Checkbox, Input, InputNumber, Segmented, message } from "antd";
import { useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { createFood } from "../api";
import type { FoodResult } from "../types";

type Props = {
  initialName: string;
  /** Viene del código de barras: el código queda guardado con el alimento. */
  barcode?: string;
  brand?: string | null;
  /** Por qué se está creando (por ejemplo, «no conozco este código»). */
  note?: string;
  onCancel: () => void;
  onCreated: (food: FoodResult) => void;
};

type Num = number | null;

/** Alimento propio: lo que dice el empaque o lo que tú sepas, por porción o por 100 g. */
export function CreateFoodForm({ initialName, barcode, brand: initialBrand, note, onCancel, onCreated }: Props) {
  const [name, setName] = useState(initialName.trim());
  const [per, setPer] = useState<"portion" | "100g">("portion");
  const [portionLabel, setPortionLabel] = useState("");
  const [portionGrams, setPortionGrams] = useState<Num>(null);
  const [kcal, setKcal] = useState<Num>(null);
  const [protein, setProtein] = useState<Num>(null);
  const [carbs, setCarbs] = useState<Num>(null);
  const [fat, setFat] = useState<Num>(null);
  // Lo del empaque (con eso se calculan los sellos): abierto de una si viene del código de barras.
  const [more, setMore] = useState(!!barcode);
  const [brand, setBrand] = useState(initialBrand?.trim() ?? "");
  const [sugar, setSugar] = useState<Num>(null);
  const [satFat, setSatFat] = useState<Num>(null);
  const [sodium, setSodium] = useState<Num>(null);
  const [sweetener, setSweetener] = useState(false);
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
        ...(barcode ? { barcode } : {}),
        ...(more
          ? {
              ...(brand.trim() ? { brand: brand.trim() } : {}),
              ...(sugar != null ? { sugar } : {}),
              ...(satFat != null ? { satFat } : {}),
              ...(sodium != null ? { sodium } : {}),
              sweetener,
            }
          : {}),
      });
      message.success(barcode ? "Producto creado: la próxima vez que lo escanees, sale solo" : "Alimento creado");
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
      <header style={{ display: "grid", gap: 8 }}>
        <h3 className="nf-detail__name">{barcode ? "Crear el producto" : "Crear un alimento"}</h3>
        {barcode && (
          <span className="nf-code-chip">
            <BarcodeOutlined /> {barcode}
          </span>
        )}
      </header>
      {note && (
        <p className="nf-note">
          <InfoCircleOutlined />
          <span>{note}</span>
        </p>
      )}
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
      <button type="button" className={`nf-morebtn${more ? " is-open" : ""}`} aria-expanded={more} onClick={() => setMore((m) => !m)}>
        <span>
          Más datos del empaque
          <small>Azúcares, grasa saturada, sodio y edulcorantes: con eso salen los sellos de advertencia</small>
        </span>
        <DownOutlined />
      </button>
      {more && (
        <div className="nf-detail" style={{ gap: 14 }}>
          <div className="nf-field">
            <label className="nf-label" htmlFor="nf-food-brand">
              Marca
            </label>
            <Input id="nf-food-brand" value={brand} maxLength={80} onChange={(e) => setBrand(e.target.value)} placeholder="Por ejemplo: Noel" />
          </div>
          <div className="nf-grid-2">
            {num("nf-sugar", "Azúcares totales", sugar, setSugar, "g")}
            {num("nf-satfat", "Grasa saturada", satFat, setSatFat, "g")}
            {num("nf-sodium", "Sodio", sodium, setSodium, "mg", 50000)}
          </div>
          <Checkbox checked={sweetener} onChange={(e) => setSweetener(e.target.checked)}>
            Tiene edulcorantes (sucralosa, aspartame, stevia…)
          </Checkbox>
          <p className="nf-hint" style={{ margin: 0 }}>
            Con los mismos valores de arriba ({per === "portion" ? "por porción" : "por 100 g"}). El sodio va en miligramos, como en la tabla.
          </p>
        </div>
      )}
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
