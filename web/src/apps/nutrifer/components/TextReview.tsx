import { CloseOutlined } from "@ant-design/icons";
import { Button, Checkbox, InputNumber, Select } from "antd";
import { useState } from "react";
import { amountOf, gramsText, kcalText, oilText, PREP_OPTIONS, quantityText } from "../math";
import type { BatchItem, MealSlot, TextCandidate, TextItem, TextProposal } from "../types";

type Props = {
  items: TextItem[];
  /** La comida donde se abrió (para lo que no dice en cuál fue). */
  defaultMeal: MealSlot;
  meals: { slot: MealSlot; name: string }[];
  busy: boolean;
  onBack: () => void;
  onSubmit: (items: BatchItem[], aliases: { phrase: string; foodId: string }[]) => void;
};

/** Lo que el usuario está decidiendo de cada cosa entendida. */
type Row = {
  include: boolean;
  foodId: string | null;
  meal: MealSlot;
  portionId: string | null;
  quantity: number;
  grams: number | null;
  prep: TextProposal["prep"];
  oilGrams: number | null;
};

const STEP = 0.5;
const HOW: Record<TextProposal["how"], string> = {
  gramos: "los gramos que dijiste",
  medida: "la medida que dijiste",
  "lo-de-siempre": "lo de siempre",
  "por-defecto": "medida casera",
};

function rowFor(item: TextItem, foodId: string | null, meal: MealSlot): Row {
  const p = foodId ? item.proposals[foodId] : undefined;
  return {
    include: foodId !== null,
    foodId,
    meal,
    portionId: p?.portionId ?? null,
    quantity: p?.quantity ?? 1,
    grams: p?.grams ?? null,
    prep: p?.prep ?? null,
    oilGrams: p?.oilGrams ?? null,
  };
}

/**
 * La revisión de «escribe o dicta»: cada cosa con su alimento (se puede cambiar), cuánto y en qué
 * comida. Nada se guarda hasta tocar «Agregar».
 */
export function TextReview({ items, defaultMeal, meals, busy, onBack, onSubmit }: Props) {
  const [rows, setRows] = useState<Row[]>(() => items.map((it) => rowFor(it, it.candidates[0]?.id ?? null, it.meal ?? defaultMeal)));
  const set = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const candidateOf = (i: number): TextCandidate | undefined => items[i].candidates.find((c) => c.id === rows[i].foodId);

  const chosen = rows.map((r, i) => ({ r, i, c: candidateOf(i) })).filter((x) => x.r.include && x.c);
  const total = chosen.reduce((s, { r, c }) => s + amountOf(c as TextCandidate, r).kcal, 0);
  const missing = items.filter((it) => it.candidates.length === 0);

  const submit = () => {
    const payload: BatchItem[] = chosen.map(({ r, c }) => ({
      meal: r.meal,
      foodId: (c as TextCandidate).id,
      quantity: r.portionId ? r.quantity : 1,
      ...(r.portionId ? { portionId: r.portionId } : { grams: r.grams ?? 100 }),
      ...(r.prep ? { prep: r.prep, oilGrams: r.oilGrams ?? 0 } : {}),
    }));
    // Lo que se corrigió se recuerda: la próxima vez esa frase trae ese alimento primero.
    const aliases = chosen
      .filter(({ i, c }) => c && items[i].candidates[0]?.id !== c.id)
      .map(({ i, c }) => ({ phrase: items[i].aliasKey, foodId: (c as TextCandidate).id }));
    onSubmit(payload, aliases);
  };

  return (
    <div className="nf-detail">
      <button type="button" className="nf-back" onClick={onBack}>
        ‹ Cambiar el texto
      </button>
      <header>
        <h3 className="nf-detail__name">Esto entendí</h3>
        <p className="nf-detail__source">Revisa y corrige: lo que cambies lo recuerdo para la próxima.</p>
      </header>

      <div className="nf-review">
        {items.map((item, i) => {
          if (item.candidates.length === 0) return null;
          const r = rows[i];
          const c = candidateOf(i);
          const amount = c ? amountOf(c, r) : null;
          const proposal = r.foodId ? item.proposals[r.foodId] : undefined;
          return (
            <section key={item.key} className={`nf-review__item${r.include ? "" : " is-off"}`} aria-label={item.phrase}>
              <div className="nf-review__top">
                <Checkbox checked={r.include} onChange={(e) => set(i, { include: e.target.checked })} aria-label={`Incluir ${item.phrase}`} />
                <span className="nf-review__phrase">«{item.phrase}»</span>
                <span className="nf-review__kcal">
                  {amount ? kcalText(amount.kcal) : "—"} <small>kcal</small>
                </span>
              </div>

              <Select
                className="nf-review__food"
                size="large"
                value={r.foodId ?? undefined}
                disabled={!r.include}
                onChange={(id: string) => setRows((list) => list.map((x, j) => (j === i ? { ...rowFor(item, id, x.meal), include: true } : x)))}
                options={item.candidates.map((cand, k) => ({
                  value: cand.id,
                  label: k === 0 && item.learned ? `${cand.name} · lo elegiste antes` : cand.name,
                }))}
                aria-label={`Alimento para «${item.phrase}»`}
                popupMatchSelectWidth={false}
              />

              {c && r.include && (
                <div className="nf-review__amount">
                  {c.isDish ? null : (
                    <Select
                      size="middle"
                      value={r.portionId ?? "g"}
                      onChange={(v: string) => {
                        if (v === "g") set(i, { portionId: null, quantity: 1, grams: Math.round(amountOf(c, r).grams) });
                        else set(i, { portionId: v, quantity: r.portionId ? r.quantity : 1 });
                      }}
                      options={[
                        ...c.portions.map((p) => ({ value: p.id, label: `${p.label} · ${Math.round(p.grams)} g` })),
                        { value: "g", label: "Gramos" },
                      ]}
                      aria-label="Medida"
                      popupMatchSelectWidth={false}
                    />
                  )}
                  {r.portionId || c.isDish ? (
                    <div className="nf-mini-stepper">
                      <button type="button" aria-label="Menos" disabled={r.quantity <= STEP} onClick={() => set(i, { quantity: Math.max(STEP, Math.round((r.quantity - STEP) * 2) / 2) })}>
                        −
                      </button>
                      <output aria-live="polite">{quantityText(r.quantity)}</output>
                      <button type="button" aria-label="Más" disabled={r.quantity >= 20} onClick={() => set(i, { quantity: Math.min(20, Math.round((r.quantity + STEP) * 2) / 2) })}>
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="nf-review__grams">
                      <InputNumber size="middle" min={1} max={5000} value={r.grams ?? 100} inputMode="decimal" onChange={(v) => set(i, { grams: typeof v === "number" ? v : null })} aria-label="Gramos" style={{ width: 96 }} />
                      <span className="nf-hint">g</span>
                    </span>
                  )}
                  <Select
                    size="middle"
                    value={r.meal}
                    onChange={(v: MealSlot) => set(i, { meal: v })}
                    options={meals.map((m) => ({ value: m.slot, label: m.name }))}
                    aria-label="Comida"
                    popupMatchSelectWidth={false}
                  />
                </div>
              )}

              {c && r.include && (
                <p className="nf-review__meta">
                  {amount ? `${Math.round(amount.grams)} g · ${gramsText(amount.protein)} g de proteína` : ""}
                  {proposal && proposal.how !== "por-defecto" ? ` · ${HOW[proposal.how]}` : ""}
                  {r.prep && (
                    <span className="nf-review__prep">
                      {PREP_OPTIONS.find((p) => p.value === r.prep)?.label.toLowerCase()}
                      {r.oilGrams ? `, +${oilText(r.oilGrams).replace(/ \(.*\)$/, "")} de aceite` : ""}
                      <button type="button" aria-label="Quitar la preparación" onClick={() => set(i, { prep: null, oilGrams: null })}>
                        <CloseOutlined />
                      </button>
                    </span>
                  )}
                </p>
              )}
            </section>
          );
        })}
      </div>

      {missing.length > 0 && (
        <p className="nf-review__missing">
          No encontré {missing.map((m) => `«${m.name}»`).join(", ")}. Búscalo después con «Agregar» o créalo.
        </p>
      )}

      <div className="nf-actions">
        <Button size="large" onClick={onBack}>
          Volver
        </Button>
        <Button type="primary" size="large" loading={busy} disabled={chosen.length === 0} onClick={submit}>
          Agregar {chosen.length} · {kcalText(total)} kcal
        </Button>
      </div>
    </div>
  );
}
