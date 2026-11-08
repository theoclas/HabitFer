import { Button, Checkbox, InputNumber } from "antd";
import { useState, type ReactNode } from "react";
import {
  canPrep,
  gramsForGoal,
  gramsText,
  intText,
  kcalText,
  MAX_OIL,
  OIL_STEP,
  oilText,
  PREP_OPTIONS,
  previewAmount,
  quantityText,
  suggestedOil,
  type GoalMacro,
} from "../math";
import type { AmountChoice, FoodDetail, Prep, Remaining } from "../types";

/** El alimento trae ese dato (los platos y recetas suman sus partes con 0 donde falta: ahí 0 es «sin dato»). */
function knows(food: FoodDetail, key: "fiber" | "sugar" | "sodium"): boolean {
  const v = food.per100[key];
  if (v == null) return false;
  return food.source === "DISH" || food.source === "RECIPE" ? v > 0 : true;
}

type Props = {
  food: FoodDetail;
  /** Para editar una anotación: lo que ya tenía. */
  initial?: AmountChoice;
  busy: boolean;
  submitLabel: (kcal: number) => string;
  onSubmit: (choice: AmountChoice) => void;
  /** Lo que falta para la meta del día (para «anotar por meta»). */
  remaining?: Remaining | null;
  /** Preguntar cómo se preparó (no en los ingredientes de una receta). */
  allowPrep?: boolean;
  /** Ofrecer «Por meta» (no en los ingredientes de una receta). */
  allowGoal?: boolean;
  /** Controles extra arriba del botón (mover de comida, borrar). */
  children?: ReactNode;
};

const STEP = 0.5;
const MAX_Q = 20;
const MAX_GRAMS = 5000;

type Mode = "portion" | "grams" | "goal";

const GOALS: { key: GoalMacro; label: string; unit: string; noun: string; presets: number[]; start: number; max: number }[] = [
  { key: "protein", label: "Proteína", unit: "g", noun: "de proteína", presets: [20, 30, 40], start: 30, max: 300 },
  { key: "kcal", label: "Calorías", unit: "kcal", noun: "", presets: [200, 300, 500], start: 300, max: 5000 },
  { key: "carbs", label: "Carbohidratos", unit: "g", noun: "de carbohidratos", presets: [30, 50, 80], start: 50, max: 600 },
  { key: "fat", label: "Grasa", unit: "g", noun: "de grasa", presets: [10, 15, 20], start: 15, max: 300 },
];

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Elegir cuánto: medida casera y cantidad, gramos exactos, por meta («30 g de proteína») o qué partes
 * del plato; y cómo se preparó, con su aceite. Muestra el total en vivo.
 */
export function AmountEditor({ food, initial, busy, submitLabel, onSubmit, remaining, allowPrep = true, allowGoal = true, children }: Props) {
  const isDish = food.parts.length > 0;
  const defaultPortion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
  const startsInGrams = !isDish && (initial ? initial.grams !== undefined && !initial.portionId : !defaultPortion);
  const [mode, setMode] = useState<Mode>(startsInGrams ? "grams" : "portion");
  const [portionId, setPortionId] = useState<string | undefined>(initial?.portionId ?? defaultPortion?.id);
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [grams, setGrams] = useState<number>(initial?.grams ?? defaultPortion?.grams ?? 100);
  const [parts, setParts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(food.parts.map((p) => [p.id, initial?.parts?.find((x) => x.partId === p.id)?.included ?? true])),
  );

  // Por meta: qué macro y cuánto.
  const usable = GOALS.filter((g) => (food.per100[g.key] ?? 0) > 0);
  const firstGoal: GoalMacro = food.per100.protein >= 5 ? "protein" : "kcal";
  const [goal, setGoal] = useState<GoalMacro>(firstGoal);
  const [target, setTarget] = useState<number>(GOALS.find((g) => g.key === firstGoal)?.start ?? 30);
  const goalDef = GOALS.find((g) => g.key === goal) ?? GOALS[0];
  const goalGrams = gramsForGoal(food.per100, goal, target);

  const base: AmountChoice = isDish
    ? { quantity, parts: food.parts.map((p) => ({ partId: p.id, included: parts[p.id] !== false })) }
    : mode === "grams"
      ? { grams: Math.max(0, grams), quantity: 1 }
      : mode === "goal"
        ? { grams: goalGrams ?? 0, quantity: 1 }
        : { portionId, quantity };
  const foodGrams = previewAmount(food, base).grams;

  // Cómo se preparó: el aceite sigue a la cantidad hasta que se cambia a mano.
  const showPrep = !isDish && allowPrep && (canPrep(food) || !!initial?.prep);
  const [prep, setPrep] = useState<Prep | null>(initial?.prep ?? null);
  const [oilManual, setOilManual] = useState<number | null>(() => {
    if (!initial?.prep) return null;
    const saved = initial.oilGrams ?? 0;
    const startGrams = previewAmount(food, { ...initial, oilGrams: 0 }).grams;
    return saved === suggestedOil(initial.prep, startGrams) ? null : saved;
  });
  const oil = prep ? (oilManual ?? suggestedOil(prep, foodGrams)) : 0;

  const choice: AmountChoice = showPrep ? { ...base, prep, oilGrams: prep && oil > 0 ? oil : null } : base;
  const { grams: totalGrams, totals } = previewAmount(food, choice);
  const tooMuch = totalGrams > MAX_GRAMS;
  const nothing = totalGrams <= 0 || tooMuch || (isDish && !food.parts.some((p) => parts[p.id] !== false));
  const oilKcal = (oil * 900) / 100;

  const pickGoal = (key: GoalMacro) => {
    setGoal(key);
    setTarget(GOALS.find((g) => g.key === key)?.start ?? 30);
  };
  const left = remaining ? Math.round(remaining[goal]) : 0;
  const goalEquivalent =
    goalGrams && defaultPortion && defaultPortion.grams > 0
      ? `≈ ${quantityText(Math.max(0.5, Math.round((goalGrams / defaultPortion.grams) * 2) / 2))} × ${lower(defaultPortion.label)}`
      : "";

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
                aria-pressed={mode === "portion" && portionId === p.id}
                onClick={() => {
                  setMode("portion");
                  setPortionId(p.id);
                }}
              >
                {p.label}
                <small>{Math.round(p.grams)} g</small>
              </button>
            ))}
            <button type="button" className="nf-chip" aria-pressed={mode === "grams"} onClick={() => setMode("grams")}>
              Gramos
            </button>
            {allowGoal && usable.length > 0 && (
              <button type="button" className="nf-chip" aria-pressed={mode === "goal"} onClick={() => setMode("goal")}>
                Por meta
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "goal" && !isDish ? (
        <div className="nf-field nf-goalbox">
          <span className="nf-label" id="nf-goal-label">
            ¿Cuánto quieres de qué?
          </span>
          <div className="nf-chips nf-chips--sm" role="group" aria-labelledby="nf-goal-label">
            {usable.map((g) => (
              <button key={g.key} type="button" className="nf-chip" aria-pressed={goal === g.key} onClick={() => pickGoal(g.key)}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="nf-goalbox__row">
            <InputNumber
              aria-label={`${goalDef.label} que quieres`}
              size="large"
              min={1}
              max={goalDef.max}
              value={target}
              inputMode="decimal"
              onChange={(v) => setTarget(typeof v === "number" ? v : 0)}
              style={{ width: 130 }}
            />
            <span className="nf-hint">
              {goalDef.unit} {goalDef.noun}
            </span>
          </div>
          <div className="nf-chips nf-chips--sm" role="group" aria-label="Cantidades rápidas">
            {goalDef.presets.map((v) => (
              <button key={v} type="button" className="nf-chip" aria-pressed={target === v} onClick={() => setTarget(v)}>
                {v} {goalDef.unit}
              </button>
            ))}
            {left > 0 && (
              <button type="button" className="nf-chip" aria-pressed={target === left} onClick={() => setTarget(Math.min(goalDef.max, left))}>
                Lo que te falta · {kcalText(left)} {goalDef.unit}
              </button>
            )}
          </div>
          <p className="nf-goalbox__result" aria-live="polite">
            {goalGrams ? (
              <>
                Te tocan <b>{kcalText(goalGrams)} g</b>
                {goalEquivalent && <span> ({goalEquivalent})</span>}
              </>
            ) : (
              "Escribe cuánto quieres."
            )}
          </p>
          {tooMuch && <p className="nf-warn">Son más de 5 kg: elige otro alimento o una meta más pequeña.</p>}
        </div>
      ) : mode === "grams" && !isDish ? (
        <div className="nf-field">
          <label className="nf-label" htmlFor="nf-grams">
            Gramos
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <InputNumber
              id="nf-grams"
              size="large"
              min={1}
              max={MAX_GRAMS}
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

      {showPrep && (
        <div className="nf-field">
          <span className="nf-label" id="nf-prep-label">
            Cómo se preparó <small className="nf-hint">(opcional)</small>
          </span>
          <div className="nf-chips nf-chips--sm" role="group" aria-labelledby="nf-prep-label">
            {PREP_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="nf-chip"
                aria-pressed={prep === p.value}
                onClick={() => {
                  setPrep((cur) => (cur === p.value ? null : p.value));
                  setOilManual(null);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {prep && (
            <div className="nf-oil">
              <span className="nf-oil__text">
                Aceite: <b>{oilText(oil)}</b>
                {oil > 0 && <small> · +{kcalText(oilKcal)} kcal</small>}
              </span>
              <div className="nf-oil__btns">
                <button type="button" aria-label="Menos aceite" disabled={oil <= 0} onClick={() => setOilManual(Math.max(0, oil - OIL_STEP))}>
                  −
                </button>
                <button type="button" aria-label="Más aceite" disabled={oil >= MAX_OIL} onClick={() => setOilManual(Math.min(MAX_OIL, oil + OIL_STEP))}>
                  +
                </button>
              </div>
            </div>
          )}
          {prep && prep !== "COCIDO" && oilManual === null && (
            <span className="nf-hint">Es lo que suele llevar; ajústalo si le echaste más o menos.</span>
          )}
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
        {kcalText(totalGrams)} g en total{oil > 0 ? `, más ${gramsText(oil)} g de aceite` : ""}
      </p>
      <div className="nf-preview-more" aria-label="Fibra, azúcar y sodio de esta cantidad">
        <span>
          Fibra <b>{knows(food, "fiber") ? `${gramsText(totals.fiber)} g` : "sin dato"}</b>
        </span>
        <span>
          Azúcar <b>{knows(food, "sugar") ? `${gramsText(totals.sugar)} g` : "sin dato"}</b>
        </span>
        <span>
          Sodio <b>{knows(food, "sodium") ? `${intText(totals.sodium)} mg` : "sin dato"}</b>
        </span>
      </div>

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
