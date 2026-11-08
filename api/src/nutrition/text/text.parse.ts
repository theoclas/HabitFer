/**
 * «Escribe o dicta»: entiende frases como «desayuné dos arepas con queso y un tinto» sin IA y sin
 * costo (funciones puras). Separa por comas e «y», lee la cantidad («dos», «media», «1,5»), la medida
 * («pocillo», «150 g», «media libra»), el tamaño, cómo se preparó y en qué comida fue. Lo que queda es
 * el alimento, que después se busca en la base.
 */
import type { Prep } from '../entry.utils';
import { normalize } from '../search.utils';

export type Slot = 'DESAYUNO' | 'MEDIAS_NUEVES' | 'ALMUERZO' | 'ONCES' | 'COMIDA';
export type Size = 'pequeño' | 'mediano' | 'grande';

/** Un alimento entendido: lo que dijo, cómo buscarlo y cuánto. */
export type ParsedItem = {
  /** El pedazo del texto original («dos arepas con queso»). */
  phrase: string;
  /** El alimento sin cantidad ni medida («arepas con queso»). */
  name: string;
  /** Palabras para buscarlo (en singular, sin «de» ni «con»). */
  search: string;
  quantity: number | null;
  /** Medida nombrada, en singular y sin tildes («pocillo», «g»). */
  unit: string | null;
  size: Size | null;
  /** Gramos si los dijo («150 g», «media libra» = 250 g). */
  grams: number | null;
  prep: Prep | null;
  meal: Slot | null;
};

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  doce: 12,
  medio: 0.5,
  media: 0.5,
};

/** Medidas caseras que se reconocen (en singular, sin tildes). */
const UNITS = new Set([
  'unidad',
  'und',
  'pocillo',
  'taza',
  'tacita',
  'vaso',
  'cucharada',
  'cucharadita',
  'plato',
  'porcion',
  'tajada',
  'presa',
  'rebanada',
  'botella',
  'lata',
  'paquete',
  'cucharon',
  'pedazo',
  'trozo',
  'copa',
  'bolsa',
]);

/** Medidas de peso o volumen y cuántos gramos son (el volumen como agua: 1 ml ≈ 1 g). */
const WEIGHT_UNITS: Record<string, number> = {
  g: 1,
  gr: 1,
  grs: 1,
  gramo: 1,
  kg: 1000,
  kilo: 1000,
  libra: 500,
  onza: 28,
  ml: 1,
  cc: 1,
  mililitro: 1,
  litro: 1000,
  l: 1000,
};

/** «arepas» → «arepa», «panes» → «pan», «porciones» → «porcion». */
export function singular(word: string): string {
  if (word.length > 4 && /[^aeiou]es$/.test(word) && !/ces$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Lo que se dice antes de la comida y no es comida. */
const LEAD = /^(hoy|ayer|anoche|y|tambien|ademas|luego|despues|me|yo|en|el|la|los|las|de|del|al|un poco de|algo de|desayune|almorce|cene|comi|tome|bebi|merende|comimos|tomamos|desayunamos|almorzamos)\b\s*/;

/** En qué comida fue, si la frase lo dice. */
function mealOf(t: string): Slot | null {
  if (/\bdesayun/.test(t)) return 'DESAYUNO';
  if (/\bmedias? nueves\b|\bmedia manana\b/.test(t)) return 'MEDIAS_NUEVES';
  if (/\balmorz|\balmuerz|\balmorce\b/.test(t)) return 'ALMUERZO';
  if (/\bonces\b|\bmerend|\bmedia tarde\b/.test(t)) return 'ONCES';
  if (/\bcen[eoa]\b|\bcenamos\b|\ben la comida\b|\bde comida\b|\ben la noche\b/.test(t)) return 'COMIDA';
  return null;
}

function prepOf(t: string): Prep | null {
  if (/\bfrit[oa]s?\b/.test(t)) return 'FRITO';
  if (/\basad[oa]s?\b|\bplancha\b/.test(t)) return 'ASADO';
  if (/\bsudad[oa]s?\b|\bguisad[oa]s?\b/.test(t)) return 'SUDADO';
  if (/\bcocid[oa]s?\b|\bhervid[oa]s?\b|\bal vapor\b/.test(t)) return 'COCIDO';
  return null;
}

function sizeOf(t: string): Size | null {
  if (/\b(pequen[oa]s?|chiquit[oa]s?|peque)\b/.test(t)) return 'pequeño';
  if (/\bmedian[oa]s?\b/.test(t)) return 'mediano';
  if (/\bgrandes?\b/.test(t)) return 'grande';
  return null;
}

/** Quita lo que dice la comida o el verbo («en el almuerzo», «desayuné»), que ya se leyó aparte. */
function stripMealWords(t: string): string {
  return t
    .replace(/\b(en el|en las|en la|de|al|para el|para la|por la) (desayuno|almuerzo|onces|comida|cena|noche|medias nueves|media manana|media tarde)\b/g, ' ')
    .replace(/\b(desayune|desayuno|desayunamos|almorce|almuerzo|almorzamos|onces|cene|cena|cenamos|merende|medias nueves)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set(['de', 'del', 'con', 'la', 'el', 'los', 'las', 'en', 'a', 'al', 'y', 'un', 'una', 'mi', 'su']);

/** Palabras para buscar un alimento: sin «de», «con»… y en singular. */
export function toSearch(food: string): string {
  const words = normalize(food)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map(singular);
  return words.join(' ') || normalize(food);
}

const PREP_WORD = /^(frit[oa]s?|asad[oa]s?|plancha|sudad[oa]s?|guisad[oa]s?|cocid[oa]s?|hervid[oa]s?|vapor|horneado|horneada)$/;

/** La búsqueda sin cómo se preparó («pechuga plancha» → «pechuga»): la preparación ya se anota aparte. */
export function stripPrepWords(search: string): string {
  return search
    .split(' ')
    .filter((w) => !PREP_WORD.test(w))
    .join(' ');
}

/**
 * «Dos huevos fritos con arepa» cuando no hay un alimento que se llame así: dos cosas. La primera
 * se queda con la cantidad y la medida; todas, con la comida.
 */
export function splitCon(item: ParsedItem): ParsedItem[] {
  const parts = item.name.split(/\s+con\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [item];
  return parts.map((name, i) => ({
    phrase: i === 0 ? item.phrase : name,
    name,
    search: toSearch(name),
    quantity: i === 0 ? item.quantity : null,
    unit: i === 0 ? item.unit : null,
    size: i === 0 ? item.size : sizeOf(name),
    grams: i === 0 ? item.grams : null,
    prep: prepOf(name),
    meal: item.meal,
  }));
}

/** Una frase con un alimento: «dos arepas», «150 g de arroz», «un pocillo de chocolate». */
function parseChunk(chunk: string, meal: Slot | null): ParsedItem | null {
  // Los decimales y las fracciones sobreviven a normalize como «1p5» y «1f2».
  let t = normalize(chunk.replace(/(\d)[.,](\d)/g, '$1p$2').replace(/(\d)\/(\d)/g, '$1f$2'));
  t = stripMealWords(t);
  for (let i = 0; i < 5; i++) t = t.replace(LEAD, '').trim();
  if (!t) return null;

  const words = t.split(' ');
  let quantity: number | null = null;
  let i = 0;
  const w0 = words[0];
  if (/^\d+(p\d+)?$/.test(w0)) {
    quantity = Number(w0.replace('p', '.'));
    i = 1;
  } else if (/^\d+f\d+$/.test(w0)) {
    const [a, b] = w0.split('f').map(Number);
    quantity = b ? a / b : null;
    i = 1;
  } else if (w0 === 'un' && words[1] === 'par') {
    quantity = 2;
    i = 2;
  } else if ((w0 === 'un' || w0 === 'una') && words[1] === 'cuarto') {
    quantity = 0.25;
    i = 2;
  } else if (w0 in NUMBER_WORDS) {
    quantity = NUMBER_WORDS[w0];
    i = 1;
  }
  // «un plato y medio» no se ve aquí (la «y» separa), pero «una y media» sí llega como «una».
  if (words[i] === 'de' && quantity !== null && words[i + 1] && UNITS.has(singular(words[i + 1]))) i += 1;

  let unit: string | null = null;
  let grams: number | null = null;
  const u = words[i] ? singular(words[i]) : '';
  if (u in WEIGHT_UNITS) {
    unit = u === 'ml' || u === 'cc' || u === 'mililitro' || u === 'litro' || u === 'l' ? 'ml' : 'g';
    grams = Math.round((quantity ?? 1) * WEIGHT_UNITS[u]);
    i += 1;
  } else if (UNITS.has(u)) {
    unit = u === 'tacita' ? 'taza' : u;
    i += 1;
  }
  if (words[i] === 'de' || words[i] === 'del') i += 1;

  const food = words.slice(i).join(' ').trim();
  if (!food) return null;
  return {
    phrase: chunk.trim(),
    name: food,
    search: toSearch(food),
    quantity: grams !== null ? 1 : quantity,
    unit,
    size: sizeOf(food),
    grams,
    prep: prepOf(food),
    meal,
  };
}

/**
 * Entiende un texto con varias cosas. La comida que se nombre vale para lo que sigue: en
 * «desayuné arepa y tinto, almorcé bandeja» la arepa y el tinto van al desayuno y la bandeja al almuerzo.
 */
export function parseFoodText(text: string): ParsedItem[] {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!clean) return [];
  const chunks = clean
    // Comas y puntos separan, salvo dentro de un número («1,5 tazas»).
    .split(/\s*(?:[,.](?!\d)|(?<!\d)[,.]|[;\n+]|\by\b|\be\b|\bmas\b|\bmás\b)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);
  let meal: Slot | null = null;
  const out: ParsedItem[] = [];
  for (const chunk of chunks.slice(0, 30)) {
    meal = mealOf(normalize(chunk)) ?? meal;
    const item = parseChunk(chunk, meal);
    if (item) out.push(item);
  }
  return out;
}
