import { Button, Checkbox, InputNumber } from "antd";
import { useState, type ReactNode } from "react";
import { gramsText, kcalText, previewAmount, quantityText } from "../math";
import type { AmountChoice, FoodDetail } from "../types";

type Props = {
  food: FoodDetail;
  /** Para editar una anotación: lo que ya tenía. */
  initial?: AmountChoice;
  busy: boolean;
  submitLabel: (kcal: number) => string;
  onSubmit: (choice: AmountChoice) => void;
  /** Controles extra arriba del botón (mover de comida, borrar). */
  children?: ReactNode;
};

const STEP = 0.5;
const MAX_Q = 20;

/** Elegir cuánto: medida casera y cantidad, gramos exactos, o qué partes del plato. Muestra el total en vivo. */
export function AmountEditor({ food, initial, busy, submitLabel, onSubmit, children }: Props) {
  const isDish = food.parts.length > 0;
  const defaultPortion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
  const startsInGrams = !isDish && (initial ? initial.grams !== undefined && !initial.portionId : !defaultPortion);
  const [inGrams, setInGrams] = useState(startsInGrams);
  const [portionId, setPortionId] = useState<string | undefined>(initial?.portionId ?? defaultPortion?.id);
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [grams, setGrams] = useState<number>(initial?.grams ?? defaultPortion?.grams ?? 100);
  const [parts, setParts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(food.parts.map((p) => [p.id, initial?.parts?.find((x) => x.partId === p.id)?.included ?? true])),
  );

  const choice: AmountChoice = isDish
    ? { quantity, parts: food.parts.map((p) => ({ partId: p.id, included: parts[p.id] !== false })) }
    : inGrams
      ? { grams: Math.max(0, grams), quantity: 1 }
      : { portionId, quantity };
  const { grams: totalGrams, totals } = previewAmount(food, choice);
  const nothing = totalGrams <= 0 || (isDish && !food.parts.some((p) => parts[p.id] !== false));

  return (
    <div className="nf-detail">
      {isDish ? (
        <div className="nf-field">
          <span className="nf-label">Qué tenía tu plato</span>
          <span className="nf-hint">Quita lo que no comiste.</span>
          <div className="nf-parts" role="group" aria-label="Partes del plato">
            {food.parts.map((p) => {
              const on = parts[p.id] !== false;
              return (
                <label key={p.id} className={`nf-part${on ? "" : " nf-part--off"}`}>
                  <Checkbox checked={on} onChange={(e) => setParts((s) => ({ ...s, [p.id]: e.target.checked }))} />
                  <span className="nf-part__name">
                    {p.label}
                    <small>{Math.round(p.grams * quantity)} g</small>
                  </span>
                  <span className="nf-part__kcal">{kcalText((p.per100.kcal * p.grams * quantity) / 100)}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="nf-field">
          <span className="nf-label">Medida</span>
          <div className="nf-chips" role="group" aria-label="Medida">
            {food.portions.map((p) => (
              <button
                key={p.id}
                type="button"
                className="nf-chip"
                aria-pressed={!inGrams && portionId === p.id}
                onClick={() => {
                  setInGrams(false);
                  setPortionId(p.id);
                }}
              >
                {p.label}
                <small>{Math.round(p.grams)} g</small>
              </button>
            ))}
            <button type="button" className="nf-chip" aria-pressed={inGrams} onClick={() => setInGrams(true)}>
              Gramos
            </button>
          </div>
        </div>
      )}

      {inGrams ? (
        <div className="nf-field">
          <label className="nf-label" htmlFor="nf-grams">
            Gramos
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <InputNumber
              id="nf-grams"
              size="large"
              min={1}
              max={5000}
              value={grams}
              inputMode="decimal"
              onChange={(v) => setGrams(typeof v === "number" ? v : 0)}
              style={{ width: 160 }}
            />
            <span className="nf-hint">g</span>
          </div>
        </div>
      ) : (
        <div className="nf-field">
          <span className="nf-label">{isDish ? "Porciones" : "Cuántas"}</span>
          <div className="nf-stepper">
            <button
              type="button"
              aria-label="Menos"
              disabled={quantity <= STEP}
              onClick={() => setQuantity((q) => Math.max(STEP, Math.round((q - STEP) * 2) / 2))}
            >
              −
            </button>
            <output aria-live="polite">{quantityText(quantity)}</output>
            <button
              type="button"
              aria-label="Más"
              disabled={quantity >= MAX_Q}
              onClick={() => setQuantity((q) => Math.min(MAX_Q, Math.round((q + STEP) * 2) / 2))}
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="nf-preview" aria-live="polite">
        <div className="is-kcal">
          <b>{kcalText(totals.kcal)}</b>
          <span>kcal</span>
        </div>
        <div>
          <b>{gramsText(totals.protein)}</b>
          <span>proteína</span>
        </div>
        <div>
          <b>{gramsText(totals.carbs)}</b>
          <span>carbohidratos</span>
        </div>
        <div>
          <b>{gramsText(totals.fat)}</b>
          <span>grasa</span>
        </div>
      </div>
      <p className="nf-hint" style={{ margin: "-8px 0 0" }}>
        {Math.round(totalGrams)} g en total
      </p>

      <details className="nf-more">
        <summary>Nutrientes por 100 g</summary>
        <div className="nf-nutrients">
          <div>
            <span>Energía</span>
            <b>{kcalText(food.per100.kcal)} kcal</b>
          </div>
          <div>
            <span>Proteína</span>
            <b>{gramsText(food.per100.protein)} g</b>
          </div>
          <div>
            <span>Carbohidratos</span>
            <b>{gramsText(food.per100.carbs)} g</b>
          </div>
          <div>
            <span>Grasa</span>
            <b>{gramsText(food.per100.fat)} g</b>
          </div>
          {food.per100.fiber != null && (
            <div>
              <span>Fibra</span>
              <b>{gramsText(food.per100.fiber)} g</b>
            </div>
          )}
          {food.per100.sugar != null && (
            <div>
              <span>Azúcar</span>
              <b>{gramsText(food.per100.sugar)} g</b>
            </div>
          )}
          {food.per100.satFat != null && (
            <div>
              <span>Grasa saturada</span>
              <b>{gramsText(food.per100.satFat)} g</b>
            </div>
          )}
          {food.per100.sodium != null && (
            <div>
              <span>Sodio</span>
              <b>{kcalText(food.per100.sodium)} mg</b>
            </div>
          )}
          {food.extra.map((n) => (
            <div key={n.key}>
              <span>{n.label}</span>
              <b>
                {gramsText(n.value)} {n.unit}
              </b>
            </div>
          ))}
        </div>
      </details>

      {children}

      <div className="nf-actions">
        <Button type="primary" size="large" loading={busy} disabled={nothing} onClick={() => onSubmit(choice)}>
          {submitLabel(totals.kcal)}
        </Button>
      </div>
    </div>
  );
}
