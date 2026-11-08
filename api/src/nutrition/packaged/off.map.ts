/**
 * Productos de Open Food Facts a alimentos de NutriFer (funciones puras). Open Food Facts es una
 * base abierta y la llena la gente: algunos productos traen errores (calorías en kJ, una coma
 * corrida), así que cada uno se revisa contra sus propios macros antes de usarlo.
 */
import { hasSweetener } from './seals';

/** Lo que se pide de cada producto. */
export const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_es',
  'generic_name_es',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'nutriments',
  'additives_tags',
  'ingredients_text_es',
  'ingredients_text',
].join(',');

export type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  generic_name_es?: string;
  brands?: string | string[];
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, unknown>;
  additives_tags?: string[];
  ingredients_text_es?: string;
  ingredients_text?: string;
};

export type PackagedFood = {
  code: string;
  name: string;
  brand: string | null;
  per100: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber: number | null;
    sugar: number | null;
    satFat: number | null;
    /** mg por 100 g. */
    sodium: number | null;
  };
  transFat: number | null;
  sweetener: boolean;
  /** Las calorías no cuadran con los macros (o faltan datos): hay que revisar el empaque. */
  check: boolean;
  /** Las calorías se calcularon con los macros porque el producto no las traía. */
  estimated: boolean;
  liquid: boolean;
  portions: { label: string; grams: number; isDefault: boolean }[];
};

/** EAN-8, UPC-A (12), EAN-13 o GTIN-14: solo números. */
export function isBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code);
}

/** El mismo código escrito de otras formas: un UPC-A (12) es un EAN-13 con un cero adelante. */
export function barcodeVariants(code: string): string[] {
  const out = [code];
  if (code.length === 12) out.push(`0${code}`);
  if (code.length === 13 && code.startsWith('0')) out.push(code.slice(1));
  return out;
}

/** «300 g», «1,5 L», «400ml», «1 kg», «6 x 30 g» → gramos (o ml) del empaque entero. */
export function parseQuantity(q: string | undefined): { amount: number; liquid: boolean } | null {
  if (!q) return null;
  const t = q.toLowerCase().replace(',', '.');
  const multi = t.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|gr|ml|cl|l)\b/);
  const one = t.match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|ml|cl|l)\b/);
  const m = multi ? { n: Number(multi[1]) * Number(multi[2]), unit: multi[3] } : one ? { n: Number(one[1]), unit: one[2] } : null;
  if (!m || !(m.n > 0)) return null;
  const factor = m.unit === 'kg' || m.unit === 'l' ? 1000 : m.unit === 'cl' ? 10 : 1;
  return { amount: Math.round(m.n * factor), liquid: m.unit === 'ml' || m.unit === 'cl' || m.unit === 'l' };
}

const firstBrand = (b: string | string[] | undefined): string | null => {
  const list = Array.isArray(b) ? b : (b ?? '').split(',');
  const brand = list.map((x) => x.trim()).find(Boolean);
  return brand ? brand.slice(0, 120) : null;
};

/** Un nutriente por 100 g: número, no negativo y con sentido. */
function n100(nut: Record<string, unknown>, key: string, max = 100): number | null {
  const raw = nut[`${key}_100g`];
  const v = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  return Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 100) / 100 : null;
}

/**
 * El alimento listo para guardar, o null si el producto no trae tabla nutricional. Revisa las
 * calorías: si parecen kJ las pasa a kcal; si no cuadran con los macros, lo marca para revisar.
 */
export function offToFood(p: OffProduct, code: string): PackagedFood | null {
  const nut = p.nutriments ?? {};
  const protein = n100(nut, 'proteins');
  const fat = n100(nut, 'fat');
  const carbs = n100(nut, 'carbohydrates');
  let kcal = n100(nut, 'energy-kcal', 1000);
  const kj = n100(nut, 'energy', 4000);
  if (kcal === null && kj !== null) kcal = Math.round((kj / 4.184) * 10) / 10;
  const macros = [protein, fat, carbs].filter((x) => x !== null).length;
  if (kcal === null && macros < 3) return null;

  const atwater = 4 * (protein ?? 0) + 4 * (carbs ?? 0) + 9 * (fat ?? 0);
  let check = macros < 3;
  let estimated = false;
  if (kcal === null) {
    kcal = Math.round(atwater);
    estimated = true;
  } else if (atwater > 20) {
    const ratio = kcal / atwater;
    // Calorías escritas en kJ (unas 4,2 veces más): se corrigen.
    if (ratio > 3.6 && ratio < 4.8) kcal = Math.round((kcal / 4.184) * 10) / 10;
    else if (Math.abs(kcal - atwater) > 0.35 * Math.max(kcal, atwater)) check = true;
  }
  if (kcal > 900) check = true;

  const sodiumG = n100(nut, 'sodium');
  const salt = n100(nut, 'salt');
  const sodium = sodiumG !== null ? Math.round(sodiumG * 1000) : salt !== null ? Math.round((salt / 2.5) * 1000) : null;

  const brand = firstBrand(p.brands);
  const base = (p.product_name_es || p.product_name || p.generic_name_es || '').trim() || 'Producto sin nombre';
  const name = (brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${base} ${brand}` : base).slice(0, 160);

  const pack = parseQuantity(p.quantity);
  const serving = Number(p.serving_quantity);
  const portions: PackagedFood['portions'] = [];
  if (Number.isFinite(serving) && serving > 0 && serving <= 5000) portions.push({ label: 'Porción del empaque', grams: Math.round(serving * 10) / 10, isDefault: true });
  if (pack && pack.amount <= 5000 && (!portions.length || Math.abs(pack.amount - portions[0].grams) > 1)) {
    portions.push({ label: pack.liquid ? 'Botella o envase' : 'Paquete', grams: pack.amount, isDefault: portions.length === 0 });
  }

  return {
    code,
    name,
    brand,
    per100: {
      kcal,
      protein: protein ?? 0,
      fat: fat ?? 0,
      carbs: carbs ?? 0,
      fiber: n100(nut, 'fiber'),
      sugar: n100(nut, 'sugars'),
      satFat: n100(nut, 'saturated-fat'),
      sodium,
    },
    transFat: n100(nut, 'trans-fat'),
    sweetener: hasSweetener(p.additives_tags, p.ingredients_text_es || p.ingredients_text),
    check,
    estimated,
    liquid: pack?.liquid ?? false,
    portions,
  };
}
