/**
 * Sellos de advertencia de los empaques colombianos (Resolución 810 de 2021, modificada por la 2492
 * de 2022), calculados por 100 g porque Open Food Facts no los trae para Colombia (funciones puras).
 *
 * - Exceso en sodio: 300 mg o más por 100 g, o 1 mg o más por cada kcal.
 * - Exceso en azúcares: 10 % o más de las calorías vienen de azúcares (se usan los azúcares totales).
 * - Exceso en grasas saturadas: 10 % o más de las calorías.
 * - Exceso en grasas trans: 1 % o más de las calorías.
 * - Contiene edulcorante: cualquier cantidad.
 */

export type Seal = 'AZUCARES' | 'SODIO' | 'GRASAS_SATURADAS' | 'GRASAS_TRANS' | 'EDULCORANTE';

export const SEAL_LABELS: Record<Seal, string> = {
  AZUCARES: 'Exceso en azúcares',
  SODIO: 'Exceso en sodio',
  GRASAS_SATURADAS: 'Exceso en grasas saturadas',
  GRASAS_TRANS: 'Exceso en grasas trans',
  EDULCORANTE: 'Contiene edulcorante',
};

export type SealInput = {
  kcal: number;
  sugar?: number | null;
  satFat?: number | null;
  /** mg por 100 g. */
  sodium?: number | null;
  transFat?: number | null;
  sweetener?: boolean | null;
};

/** Los sellos que le tocarían (en el orden en que suelen ir en el empaque). */
export function computeSeals(v: SealInput): Seal[] {
  const out: Seal[] = [];
  const kcal = v.kcal > 0 ? v.kcal : 0;
  const share = (grams: number | null | undefined, kcalPerGram: number) => (kcal > 0 && grams ? (grams * kcalPerGram) / kcal : 0);
  if (share(v.sugar, 4) >= 0.1) out.push('AZUCARES');
  if (v.sodium != null && (v.sodium >= 300 || (kcal >= 1 && v.sodium / kcal >= 1))) out.push('SODIO');
  if (share(v.satFat, 9) >= 0.1) out.push('GRASAS_SATURADAS');
  if (share(v.transFat, 9) >= 0.01) out.push('GRASAS_TRANS');
  if (v.sweetener) out.push('EDULCORANTE');
  return out;
}

/** Aditivos que son edulcorantes (intensos y polialcoholes), como los nombra Open Food Facts. */
const SWEETENER_ADDITIVES = new Set([
  'en:e420',
  'en:e421',
  'en:e950',
  'en:e951',
  'en:e952',
  'en:e953',
  'en:e954',
  'en:e955',
  'en:e957',
  'en:e959',
  'en:e960',
  'en:e960a',
  'en:e961',
  'en:e962',
  'en:e965',
  'en:e966',
  'en:e967',
  'en:e968',
  'en:e969',
]);
const SWEETENER_WORDS = /sucralosa|aspartam|acesulfam|sacarina|ciclamato|stevia|estevia|esteviol|neotam|advantam|sorbitol|maltitol|xilitol|eritritol|isomalt/i;

/** ¿Lleva edulcorante? Por los aditivos o por la lista de ingredientes. */
export function hasSweetener(additives: string[] | undefined, ingredients: string | undefined): boolean {
  if (additives?.some((a) => SWEETENER_ADDITIVES.has(a.toLowerCase()))) return true;
  return !!ingredients && SWEETENER_WORDS.test(ingredients);
}
