/**
 * Búsqueda de alimentos de NutriFer (funciones puras, con pruebas). Se busca en memoria: la base
 * compartida son unos pocos miles de alimentos, así que no hace falta un motor aparte.
 */

/** Minúsculas, sin tildes ni signos (la ñ queda como n), espacios simples. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Palabras que no ayudan a encontrar un alimento. */
const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'en', 'al', 'a', 'o', 'para', 'por']);

export type Query = { tokens: string[]; excluded: string[]; phrase: string };

/** «arepa sin queso» → busca «arepa» y descarta lo que diga «queso». */
export function parseQuery(q: string): Query {
  const words = normalize(q).split(' ').filter(Boolean);
  const tokens: string[] = [];
  const excluded: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 'sin' && words[i + 1]) {
      excluded.push(words[++i]);
      continue;
    }
    if (w === 'con') continue;
    if (!STOPWORDS.has(w)) tokens.push(w);
  }
  return { tokens, excluded, phrase: tokens.join(' ') };
}

/** Distancia de edición (Damerau-Levenshtein con transposiciones) acotada: corta en cuanto pasa `max`. */
export function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  if (a === b) return true;
  const n = a.length;
  const m = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return false;
    prev2 = prev;
    prev = cur;
  }
  return prev[m] <= max;
}

/** Errores de escritura que se perdonan según el largo de la palabra (en las cortas confunde: «sopa» no es «soda»). */
function allowedEdits(token: string): number {
  if (token.length >= 8) return 2;
  if (token.length >= 5) return 1;
  return 0;
}

/** Qué tan bien coincide una palabra de la búsqueda con las palabras de un alimento (0 = nada). */
export function tokenScore(token: string, words: string[]): number {
  let best = 0;
  const edits = allowedEdits(token);
  for (const w of words) {
    if (w === token) return 10;
    if (w.startsWith(token)) best = Math.max(best, token.length >= 2 ? 7 : 3);
    else if (token.length >= 3 && w.includes(token)) best = Math.max(best, 4);
    // Errores de escritura: casi nunca en la primera letra («tinto» no es «pintón»).
    else if (edits > 0 && w[0] === token[0]) {
      // Contra la palabra completa, o contra su comienzo con un solo error («arep» ≈ «arepa»).
      if (withinEdits(token, w, edits) || (w.length > token.length && withinEdits(token, w.slice(0, token.length), 1))) {
        best = Math.max(best, 3);
      }
    }
  }
  return best;
}

export type SearchItem = {
  id: string;
  /** Nombre normalizado. */
  name: string;
  /** Palabras del nombre, los alias y la categoría, normalizadas y sin repetir. */
  words: string[];
  source: string;
  /** Lo que el nombre dice que NO tiene («Café… sin azúcar» → ["azucar"]). */
  without?: string[];
  /** Prioridad de la base: lo de todos los días arriba, lo raro abajo. */
  priority?: number;
  /** Veces que el usuario lo ha anotado (más arriba lo de siempre). */
  uses?: number;
};

/** Palabras que siguen a «sin» en un nombre: «Arroz blanco, cocido, sin sal» → ["sal"]. */
export function withoutWords(name: string): string[] {
  const words = normalize(name).split(' ');
  const out: string[] = [];
  for (let i = 0; i < words.length - 1; i++) if (words[i] === 'sin') out.push(words[i + 1]);
  return out;
}

/** Puntaje de un alimento para una búsqueda; 0 si no sirve. */
export function scoreItem(item: SearchItem, q: Query): number {
  if (q.tokens.length === 0) return 0;
  let score = 0;
  for (const ex of q.excluded) {
    // «café sin azúcar» no descarta el café cuyo nombre ya dice «sin azúcar»: lo sube.
    if (item.without?.some((w) => w === ex || w.startsWith(ex))) {
      score += 6;
      continue;
    }
    if (item.words.some((w) => w === ex || w.startsWith(ex))) return 0;
  }
  for (const t of q.tokens) {
    const s = tokenScore(t, item.words);
    if (s === 0) return 0;
    score += s;
  }
  if (item.name === q.phrase) score += 15;
  else if (item.name.startsWith(q.phrase)) score += 8;
  const nameWords = item.name.split(' ');
  if (nameWords[0] === q.tokens[0] || nameWords[0]?.startsWith(q.tokens[0])) score += 3;
  // Lo crudo casi nunca es lo que se come: abajo, salvo que se busque «crudo».
  if (/\bcrud[oa]s?\b/.test(item.name) && !q.tokens.some((t) => t.startsWith('crud'))) score -= 3;
  // Nombres cortos primero («Arroz blanco» antes que «Arroz blanco con fideos y verduras»).
  score -= Math.min(5, nameWords.length * 0.35);
  if (item.source === 'USER') score += 4;
  score += item.priority ?? 0;
  if (item.uses) score += Math.min(12, 4 * Math.log2(1 + item.uses));
  return score;
}

/** Los `limit` mejores, de mayor a menor puntaje (empate: nombre más corto). */
export function rank<T extends SearchItem>(items: T[], query: string, limit = 20): T[] {
  const q = parseQuery(query);
  if (q.tokens.length === 0) return [];
  return items
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length)
    .slice(0, limit)
    .map((r) => r.item);
}

/** Palabras únicas y normalizadas de varios textos (nombre, alias, categoría). */
export function wordsOf(...texts: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const w of normalize(t).split(' ')) if (w && !STOPWORDS.has(w)) set.add(w);
  }
  return [...set];
}
