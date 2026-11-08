/** Cómo se convierte lo que el usuario elige (medida, cantidad, partes) en una anotación (funciones puras). */
import { dishTotals, formatQuantity, roundTotals, scale, type Per100, type Totals } from './nutrition-math';
import { normalize } from './search.utils';

export type PortionLike = { id: string; label: string; grams: number; isDefault: boolean };
export type PartLike = { id: string; label: string; grams: number; foodId: string; food: Per100 };

export type FoodForEntry = Per100 & {
  id: string;
  name: string;
  portions: PortionLike[];
  parts: PartLike[];
};

export type EntryInput = {
  portionId?: string;
  portionLabel?: string;
  grams?: number;
  quantity?: number;
  parts?: { partId: string; included: boolean; grams?: number }[];
};

export type SavedPart = { partId: string; label: string; foodId: string; grams: number; included: boolean };

export type EntryValues = {
  name: string;
  portionLabel: string | null;
  portionGrams: number | null;
  quantity: number;
  grams: number;
  totals: Totals;
  parts: SavedPart[] | null;
};

export class EntryInputError extends Error {}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Valores de una anotación. Orden: plato por partes → medida elegida (por id o por nombre) →
 * gramos exactos → medida por defecto del alimento → 100 g.
 */
export function computeEntry(food: FoodForEntry, input: EntryInput): EntryValues {
  const quantity = input.quantity ?? 1;

  if (food.parts.length > 0) {
    const chosen = new Map((input.parts ?? []).map((p) => [p.partId, p]));
    const parts = food.parts.map((p) => {
      const c = chosen.get(p.id);
      return { partId: p.id, label: p.label, foodId: p.foodId, grams: c?.grams ?? p.grams, included: c ? c.included : true, per100: p.food };
    });
    if (!parts.some((p) => p.included)) throw new EntryInputError('Deja al menos una parte del plato.');
    const { grams, totals } = dishTotals(parts, quantity);
    const portion = food.portions.find((p) => p.isDefault) ?? null;
    return {
      name: food.name,
      portionLabel: portion?.label ?? 'Plato',
      portionGrams: round1(parts.reduce((g, p) => g + p.grams, 0)),
      quantity,
      grams: round1(grams),
      totals: roundTotals(totals),
      parts: parts.map(({ partId, label, foodId, grams: g, included }) => ({ partId, label, foodId, grams: g, included })),
    };
  }

  let portion: PortionLike | undefined;
  if (input.portionId) {
    portion = food.portions.find((p) => p.id === input.portionId);
    if (!portion) throw new EntryInputError('Esa medida no es de este alimento.');
  } else if (input.portionLabel) {
    const wanted = normalize(input.portionLabel);
    portion = food.portions.find((p) => normalize(p.label) === wanted);
  }

  if (portion) {
    const grams = portion.grams * quantity;
    return {
      name: food.name,
      portionLabel: portion.label,
      portionGrams: portion.grams,
      quantity,
      grams: round1(grams),
      totals: roundTotals(scale(food, grams)),
      parts: null,
    };
  }

  if (input.grams !== undefined) {
    // Repetir una anotación vieja cuya medida ya no existe: se conserva su nombre.
    if (input.portionLabel) {
      return {
        name: food.name,
        portionLabel: input.portionLabel.slice(0, 80),
        portionGrams: round1(input.grams / quantity),
        quantity,
        grams: round1(input.grams),
        totals: roundTotals(scale(food, input.grams)),
        parts: null,
      };
    }
    return {
      name: food.name,
      portionLabel: null,
      portionGrams: null,
      quantity: 1,
      grams: round1(input.grams),
      totals: roundTotals(scale(food, input.grams)),
      parts: null,
    };
  }

  const fallback = food.portions.find((p) => p.isDefault) ?? food.portions[0];
  if (fallback) return computeEntry(food, { ...input, portionId: fallback.id });
  return computeEntry(food, { ...input, grams: 100 * quantity });
}

/** «1 arepa pequeña · 56 g», «2 × pocillo · 480 g», «150 g». */
export function amountText(e: { portionLabel: string | null; quantity: number; grams: number | null }): string {
  const g = e.grams != null ? `${Math.round(e.grams)} g` : '';
  const label = e.portionLabel?.trim();
  if (!label || /^\d+([.,]\d+)?\s*g$/i.test(label)) return g;
  const lower = label.charAt(0).toLowerCase() + label.slice(1);
  const amount = e.quantity === 1 ? `1 ${lower}` : `${formatQuantity(e.quantity)} × ${lower}`;
  return g ? `${amount} · ${g}` : amount;
}
