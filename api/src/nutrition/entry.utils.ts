/** Cómo se convierte lo que el usuario elige (medida, cantidad, partes) en una anotación (funciones puras). */
import { dishTotals, formatQuantity, roundTotals, scale, sumTotals, type Per100, type Totals } from './nutrition-math';
import { normalize } from './search.utils';

export type PortionLike = { id: string; label: string; grams: number; isDefault: boolean };
export type PartLike = { id: string; label: string; grams: number; foodId: string; food: Per100 };

export type FoodForEntry = Per100 & {
  id: string;
  name: string;
  portions: PortionLike[];
  parts: PartLike[];
};

/** Cómo se preparó (igual que el enum CookMethod de Prisma). */
export type Prep = 'COCIDO' | 'ASADO' | 'SUDADO' | 'FRITO';

/** Para el texto de la cantidad: «1 unidad · 50 g · frito, +5 g de aceite». */
export const PREP_SHORT: Record<Prep, string> = {
  COCIDO: 'cocido',
  ASADO: 'asado',
  SUDADO: 'sudado',
  FRITO: 'frito',
};

/** Aceite vegetal (tabla del ICBF, D013): 900 kcal y 100 g de grasa por 100 g. */
export const OIL_PER100: Per100 = { kcal: 900, protein: 0, fat: 100, carbs: 0, fiber: 0, sugar: 0, sodium: 0 };

/** Máximo de aceite en una anotación (unas 20 cucharadas). */
export const MAX_OIL_GRAMS = 300;

export type EntryInput = {
  portionId?: string;
  portionLabel?: string;
  grams?: number;
  quantity?: number;
  parts?: { partId: string; included: boolean; grams?: number }[];
  prep?: Prep | null;
  oilGrams?: number | null;
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
  prep: Prep | null;
  oilGrams: number | null;
};

export class EntryInputError extends Error {}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Suma el aceite de la preparación (los platos por partes ya traen el suyo). */
function withPrep(v: Omit<EntryValues, 'prep' | 'oilGrams'>, input: EntryInput): EntryValues {
  if (v.parts) return { ...v, prep: null, oilGrams: null };
  const oil = input.oilGrams && input.oilGrams > 0 ? round1(Math.min(input.oilGrams, MAX_OIL_GRAMS)) : 0;
  return {
    ...v,
    totals: oil > 0 ? roundTotals(sumTotals([v.totals, scale(OIL_PER100, oil)])) : v.totals,
    prep: input.prep ?? null,
    oilGrams: oil > 0 ? oil : null,
  };
}

/**
 * Valores de una anotación. Orden: plato por partes → medida elegida (por id o por nombre) →
 * gramos exactos → medida por defecto del alimento → 100 g. Al final suma el aceite si se frió.
 */
export function computeEntry(food: FoodForEntry, input: EntryInput): EntryValues {
  return withPrep(baseEntry(food, input), input);
}

function baseEntry(food: FoodForEntry, input: EntryInput): Omit<EntryValues, 'prep' | 'oilGrams'> {
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
  if (fallback) return baseEntry(food, { ...input, portionId: fallback.id });
  return baseEntry(food, { ...input, grams: 100 * quantity });
}

/** Lo guardado de una anotación (o de una comida guardada), para volver a anotarlo igual. */
export type SavedAmount = {
  portionLabel: string | null;
  quantity: number;
  grams: number | null;
  parts: unknown;
  prep?: Prep | null;
  oilGrams?: number | null;
};

/** La misma cantidad, medida, partes y preparación de algo que ya se anotó. */
export function inputFromSaved(s: SavedAmount): EntryInput {
  const parts = Array.isArray(s.parts) ? (s.parts as { partId?: unknown; included?: unknown; grams?: unknown }[]) : [];
  return {
    portionLabel: s.portionLabel ?? undefined,
    grams: s.grams ?? undefined,
    quantity: s.quantity,
    parts: parts
      .filter((p) => typeof p.partId === 'string')
      .map((p) => ({ partId: p.partId as string, included: p.included !== false, grams: typeof p.grams === 'number' ? p.grams : undefined })),
    prep: s.prep ?? null,
    oilGrams: s.oilGrams ?? null,
  };
}

/** «1 arepa pequeña · 56 g», «2 × pocillo · 480 g», «150 g», «1 unidad · 50 g · frito, +5 g de aceite». */
export function amountText(e: { portionLabel: string | null; quantity: number; grams: number | null; prep?: Prep | null; oilGrams?: number | null }): string {
  const g = e.grams != null ? `${Math.round(e.grams)} g` : '';
  const label = e.portionLabel?.trim();
  let text = g;
  if (label && !/^\d+([.,]\d+)?\s*g$/i.test(label)) {
    const lower = label.charAt(0).toLowerCase() + label.slice(1);
    // «2 huevos» o «3 tajadas» ya dicen cuántos: no «1 2 huevos».
    const counted = /^[\d½¼¾]/.test(lower);
    const amount = e.quantity === 1 ? (counted ? lower : `1 ${lower}`) : `${formatQuantity(e.quantity)} × ${lower}`;
    text = g ? `${amount} · ${g}` : amount;
  }
  const oil = e.oilGrams && e.oilGrams > 0 ? `+${String(Math.round(e.oilGrams * 10) / 10).replace('.', ',')} g de aceite` : '';
  const prep = e.prep ? PREP_SHORT[e.prep] : '';
  const extra = [prep, oil].filter(Boolean).join(', ');
  return extra ? (text ? `${text} · ${extra}` : extra) : text;
}
