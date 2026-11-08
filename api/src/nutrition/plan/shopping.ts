import { normalize } from '../search.utils';

/** Un ingrediente de lo planeado, ya en gramos. */
export type Ingredient = {
  foodId: string;
  name: string;
  category: string | null;
  grams: number;
  /** La medida por defecto del alimento (para contar unidades). */
  unit: { label: string; grams: number } | null;
};

export type ShoppingItem = {
  foodId: string;
  name: string;
  grams: number;
  /** Cómo comprarlo: «3 unidades», «1,2 kg (≈ 2½ libras)», «900 g cocido ≈ 360 g en crudo». */
  amount: string;
  /** En cuántas comidas del plan aparece. */
  uses: number;
};

export type ShoppingGroup = { category: string; items: ShoppingItem[] };

const nf1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const half = (n: number) => Math.ceil(n * 2) / 2;
const fraction = (n: number) => {
  const whole = Math.floor(n);
  const rest = n - whole;
  return rest >= 0.5 ? (whole ? `${whole}½` : '½') : String(whole);
};

/** Medidas que se compran contadas (no las de servir, como pocillo o cucharada). */
const COUNTABLE = /\b(unidad|unidades|huevo|huevos|arepa|arepas|presa|presas|pan|panes|banano|mazorca|empanada|tajada|aguacate|limon|naranja|mango|papa|pechuga)\b/;
/** Cocido → crudo: cuánto pesa más cocido (arroz ≈ 2,5 veces). */
const COOKED: [RegExp, number][] = [
  [/\barroz\b/, 2.5],
  [/\b(pasta|espagueti|espaguetis|macarrones|fideos)\b/, 2.25],
  [/\b(frijol|frijoles|frisol)\b/, 2.4],
  [/\blentejas?\b/, 2.5],
  [/\bgarbanzos?\b/, 2.2],
];

function weightText(g: number): string {
  if (g >= 1000) return `${nf1.format(Math.round(g / 100) / 10)} kg`;
  return `${Math.round(g / 10) * 10 || Math.round(g)} g`;
}

/** Cómo comprarlo. */
export function buyText(name: string, grams: number, unit: Ingredient['unit']): string {
  const n = normalize(name);
  const cooked = /\bcocid[oa]s?\b/.test(n) ? COOKED.find(([re]) => re.test(n)) : undefined;
  if (cooked) return `${weightText(grams)} cocido ≈ ${weightText(grams / cooked[1])} en crudo`;
  if (unit && unit.grams > 0 && COUNTABLE.test(normalize(unit.label))) {
    const count = half(grams / unit.grams);
    return `${fraction(count)} ${count === 1 ? 'unidad' : 'unidades'} (${weightText(grams)})`;
  }
  // En la plaza se pide por libras (500 g).
  if (grams >= 400) return `${weightText(grams)} (≈ ${fraction(half(grams / 500))} ${grams / 500 > 1 ? 'libras' : 'libra'})`;
  return weightText(grams);
}

/** «Huevo de gallina, entero, crudo» y «Huevo de gallina, frito» se compran igual: se juntan por el nombre corto. */
const shortName = (name: string) => name.split(',')[0].trim();

/** Suma lo planeado por alimento (o por nombre corto) y lo agrupa por categoría (las de la tabla), de la A a la Z. */
export function shoppingList(ingredients: Ingredient[]): ShoppingGroup[] {
  const by = new Map<string, { i: Ingredient; grams: number; uses: number }>();
  for (const i of ingredients) {
    if (!(i.grams > 0)) continue;
    // Lo cocido y lo crudo no se juntan (se compran distinto).
    const key = `${normalize(shortName(i.name))}|${/\bcocid[oa]s?\b/.test(normalize(i.name)) ? 'cocido' : ''}`;
    const cur = by.get(key);
    if (cur) {
      cur.grams += i.grams;
      cur.uses += 1;
    } else by.set(key, { i, grams: i.grams, uses: 1 });
  }
  const groups = new Map<string, ShoppingItem[]>();
  for (const { i, grams, uses } of by.values()) {
    const category = i.category?.trim() || 'Otros';
    const list = groups.get(category) ?? [];
    list.push({ foodId: i.foodId, name: i.name, grams: Math.round(grams), amount: buyText(i.name, grams, i.unit), uses });
    groups.set(category, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'Otros' ? 1 : b === 'Otros' ? -1 : a.localeCompare(b, 'es')))
    .map(([category, items]) => ({ category, items: items.sort((a, b) => a.name.localeCompare(b.name, 'es')) }));
}
