/**
 * Cuánto proponer de cada alimento entendido (funciones puras): los gramos que se dijeron, la medida
 * que se nombró, lo de siempre (lo que el usuario anotó la última vez de ese alimento: así «aprende»
 * sus porciones) o la medida por defecto. Y cuándo sumar el aceite de la preparación.
 */
import type { PortionLike, Prep } from '../entry.utils';
import { normalize } from '../search.utils';
import { singular, type ParsedItem } from './text.parse';

/** Lo que el usuario anotó la última vez de ese alimento. */
export type Usual = { portionLabel: string | null; quantity: number; grams: number | null };

export type Proposal = {
  portionId?: string;
  quantity: number;
  grams?: number;
  /** De dónde salió, para mostrarlo: «lo de siempre», «la medida que dijiste»… */
  how: 'gramos' | 'medida' | 'lo-de-siempre' | 'por-defecto';
};

/** Medidas que no dicen más que «una» (se usa la de siempre o la medida por defecto). */
const GENERIC_UNITS = new Set(['unidad', 'und', 'porcion', 'pedazo', 'trozo']);
const SIZE_STEMS: Record<string, string[]> = { pequeño: ['pequen', 'chiquit'], mediano: ['median'], grande: ['grand'] };

const clampGrams = (g: number) => Math.round(Math.min(5000, Math.max(1, g)) * 10) / 10;
const wordsOf = (s: string) => normalize(s).split(' ').map(singular);

/** La medida de este alimento que coincide con la que se nombró («pocillo» → «Pocillo tintero») o con el tamaño. */
export function matchPortion<P extends PortionLike>(portions: P[], unit: string | null, size: string | null): P | undefined {
  if (portions.length === 0) return undefined;
  const bySize = (list: P[]) => {
    if (!size) return undefined;
    const stems = SIZE_STEMS[size] ?? [];
    return list.find((p) => stems.some((s) => normalize(p.label).includes(s)));
  };
  const u = unit ? singular(normalize(unit)) : null;
  if (u && !GENERIC_UNITS.has(u)) {
    const byUnit = portions.filter((p) => wordsOf(p.label).includes(u));
    if (byUnit.length === 0) return undefined;
    return bySize(byUnit) ?? byUnit.find((p) => p.isDefault) ?? byUnit[0];
  }
  return bySize(portions);
}

/**
 * La cantidad propuesta. Orden: gramos dichos → medida nombrada (o tamaño) → lo de siempre →
 * medida por defecto → 100 g. La cantidad dicha («dos») multiplica la medida.
 */
export function proposeAmount(
  food: { portions: PortionLike[] },
  item: Pick<ParsedItem, 'quantity' | 'unit' | 'size' | 'grams'>,
  usual: Usual | null,
): Proposal {
  const q = item.quantity && item.quantity > 0 ? item.quantity : null;
  if (item.grams && item.grams > 0) return { grams: clampGrams(item.grams), quantity: 1, how: 'gramos' };

  const portion = matchPortion(food.portions, item.unit, item.size);
  if (portion) return { portionId: portion.id, quantity: q ?? 1, how: 'medida' };

  if (usual) {
    const label = usual.portionLabel;
    const same = label ? food.portions.find((p) => normalize(p.label) === normalize(label)) : undefined;
    if (same) return { portionId: same.id, quantity: q ?? usual.quantity, how: 'lo-de-siempre' };
    if (usual.grams && usual.grams > 0) {
      // Si se anotó «2 × medida que ya no existe», cada una pesaba grams / quantity.
      const perUnit = label ? usual.grams / (usual.quantity || 1) : usual.grams;
      const times = q ?? (label ? usual.quantity : 1);
      return { grams: clampGrams(perUnit * times), quantity: 1, how: 'lo-de-siempre' };
    }
  }

  const def = food.portions.find((p) => p.isDefault) ?? food.portions[0];
  if (def) return { portionId: def.id, quantity: q ?? 1, how: 'por-defecto' };
  return { grams: clampGrams(100 * (q ?? 1)), quantity: 1, how: 'por-defecto' };
}

/* ---------- Preparación (igual que en el teléfono) ---------- */

/** Lo que ya dice cómo se preparó (la tabla trae el aceite incluido). */
const READY = /frit|asad|dorad|sudad|guisad|apanad|propia grasa|horne|en aceite|tostad|ahumad/i;
const COOKABLE = ['Carnes', 'Pescados', 'Huevos', 'Verduras', 'Cereales', 'Leguminosas', 'Alimentos nativos'];
const PREP_PCT: Record<Prep, number> = { COCIDO: 0, ASADO: 0.03, SUDADO: 0.05, FRITO: 0.1 };

/** ¿Tiene sentido sumarle aceite? Carnes, huevos, verduras, cereales… crudos o cocidos, que no vengan ya fritos. */
export function canPrep(food: { name: string; category: string | null; source: string; isDish: boolean }): boolean {
  if (food.isDish || food.source === 'RECIPE' || food.source === 'DISH') return false;
  if (!food.category || READY.test(food.name)) return false;
  return COOKABLE.some((c) => food.category?.startsWith(c));
}

/** Aceite que suele llevar, en medias cucharaditas (media como mínimo si lleva). */
export function suggestedOil(prep: Prep, grams: number): number {
  const pct = PREP_PCT[prep];
  if (pct <= 0 || grams <= 0) return 0;
  return Math.min(300, Math.max(2.5, Math.round((grams * pct) / 2.5) * 2.5));
}
