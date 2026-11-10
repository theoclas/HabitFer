/**
 * «Escribe como hablas»: entiende frases como «almuerzo 18 lucas nequi», «mercado 1,2 palos tarjeta» o «pasé 200
 * lucas de Bancolombia a Nequi» sin IA y sin costo (funciones puras). Saca el monto (lucas, palos, mil, millones),
 * la fecha (ayer, el lunes), la cuenta, si es gasto, ingreso o transferencia, la categoría y el comercio. Lo que
 * queda es la nota. Las palabras que la persona le enseñó mandan sobre las de FerFinance.
 */
import {
  ACCOUNT_KIND_WORDS,
  CARD_PAYMENT_PHRASES,
  DEPOSIT_VERBS,
  EDGE_FILLERS,
  EXPENSE_VERBS,
  GENERIC_ACCOUNT_WORDS,
  INCOME_PHRASES,
  STOPWORDS,
  SYSTEM_CATEGORIES,
  TRANSFER_NOUNS,
  TRANSFER_VERBS,
  WITHDRAW_VERBS,
  type CategoryKindKey,
} from './money-text.data';

export type ParseAccount = {
  id: string;
  name: string;
  institution: string | null;
  kind: string;
};

export type ParseCategory = {
  id: string;
  kind: CategoryKindKey;
  systemKey: string | null;
  parentId: string | null;
  name: string;
};

export type ParseKeyword = {
  keyword: string;
  categoryId: string | null;
  accountId: string | null;
};

export type ParseContext = {
  todayKey: string;
  /** Solo las activas. */
  accounts: ParseAccount[];
  /** Solo las activas. */
  categories: ParseCategory[];
  keywords: ParseKeyword[];
};

export type ParsedType = 'EXPENSE' | 'INCOME' | 'TRANSFER';

export type ParsedMoneyText = {
  type: ParsedType;
  amount: number | null;
  /** «18» se tomó como $ 18.000. */
  assumedThousands: boolean;
  date: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  note: string | null;
  /** Palabras que no entendió (para enseñarlas), solo si no encontró categoría. */
  unknown: string[];
  hints: string[];
};

/** Minúsculas y sin tildes («Almuerzó» → «almuerzo»). */
export function normalizeText(s: string): string {
  return s.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Una palabra o frase normalizada y con espacios simples. */
export function normalizeKeyword(s: string): string {
  return normalizeText(s)
    .replace(/[^a-z0-9ñ$%x\s.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Números ----------

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
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiun: 21,
  veintiuno: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  doscientas: 200,
  trescientos: 300,
  trescientas: 300,
  cuatrocientos: 400,
  cuatrocientas: 400,
  quinientos: 500,
  quinientas: 500,
  seiscientos: 600,
  seiscientas: 600,
  setecientos: 700,
  setecientas: 700,
  ochocientos: 800,
  ochocientas: 800,
  novecientos: 900,
  novecientas: 900,
  medio: 0.5,
  media: 0.5,
};
/** Palabras-número que solas casi siempre son un artículo, no un monto. */
const WEAK_NUMBER_WORDS = new Set(['un', 'uno', 'una', 'medio', 'media']);

const THOUSAND_UNITS = new Set([
  'mil',
  'k',
  'luca',
  'lucas',
  'luquita',
  'luquitas',
  'luka',
  'lukas',
  'lukita',
  'lukitas',
  'barra',
  'barras',
]);
const MILLION_UNITS = new Set([
  'millon',
  'millones',
  'palo',
  'palos',
  'melon',
  'melones',
  'm',
  'mill',
]);
const PESO_UNITS = new Set(['peso', 'pesos', 'cop']);
/** Unidades que solo cuentan pegadas al número. */
const LOOSE_UNIT_EXCLUDED = new Set(['m', 'mill']);
/** Unidades que pueden empezar un monto sin número antes («palo y medio», «mil pesos»). */
const START_UNITS = new Set([
  'palo',
  'luca',
  'luka',
  'lukita',
  'luquita',
  'melon',
  'barra',
  'mil',
  'millon',
]);

const NUMERIC = /^\d+(?:[.,]\d+)*$/;

/** Lee «18.000», «1,2», «3.5» o «1.234.567,89». Con decimales solo si el número va antes de mil o millones. */
export function parseNumeric(s: string): number | null {
  if (!NUMERIC.test(s)) return null;
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  if (/^\d+[.,]\d{1,2}$/.test(s)) return Number(s.replace(',', '.'));
  const mixedDots = /^(\d{1,3}(?:\.\d{3})+),\d{1,2}$/.exec(s);
  if (mixedDots) return Number(mixedDots[1].replace(/\./g, ''));
  const mixedCommas = /^(\d{1,3}(?:,\d{3})+)\.\d{1,2}$/.exec(s);
  if (mixedCommas) return Number(mixedCommas[1].replace(/,/g, ''));
  if (/^\d+$/.test(s)) return Number(s);
  const n = Number(s.replace(/[.,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

type AmountReading = {
  value: number;
  hasUnit: boolean;
  assumedThousands: boolean;
  raw: number;
};

/** Valor de una seguidilla de números y unidades: «un palo y medio», «2 palos 300», «18 mil 500», «media luca». */
export function readAmount(words: string[]): AmountReading | null {
  let total = 0;
  let current = 0;
  let lastUnit = 0;
  let sawUnit = false;
  let pesos = false;
  let raw = 0;
  for (const w of words) {
    if (w === '$' || w === 'y') continue;
    const numeric = parseNumeric(w);
    if (numeric !== null) {
      current += numeric;
      raw = Math.max(raw, numeric);
      continue;
    }
    const word = NUMBER_WORDS[w];
    if (word !== undefined) {
      if (word === 0.5 && lastUnit > 0 && current === 0)
        total += 0.5 * lastUnit;
      else current += word;
      raw = Math.max(raw, word);
      continue;
    }
    if (THOUSAND_UNITS.has(w) || MILLION_UNITS.has(w)) {
      const unit = THOUSAND_UNITS.has(w) ? 1_000 : 1_000_000;
      total += (current || 1) * unit;
      current = 0;
      lastUnit = unit;
      sawUnit = true;
      continue;
    }
    if (PESO_UNITS.has(w)) pesos = true;
  }
  if (current > 0) {
    if (lastUnit === 1_000_000 && current < 1_000) total += current * 1_000;
    else total += current;
  }
  if (!(total > 0)) return null;
  let value = total;
  let assumedThousands = false;
  if (!sawUnit && !pesos && value < 1_000) {
    value *= 1_000;
    assumedThousands = true;
  }
  return {
    value: Math.round(value),
    hasUnit: sawUnit || pesos,
    assumedThousands,
    raw,
  };
}

// ---------- Fechas ----------

const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];

function shiftDays(key: string, days: number): string {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- Palabras ----------

type Token = {
  /** Texto original (sin la puntuación de los bordes). */
  raw: string;
  norm: string;
  /** Índice de la palabra original (las pegadas, como «18lucas», comparten índice). */
  index: number;
  used: boolean;
  /** Unidad que venía pegada al número («18k», «1.5m»). */
  glued?: boolean;
};

const UNIT_SUFFIX =
  /^(\d+(?:[.,]\d+)*)(k|mil|lucas?|luquitas?|lukas?|lukitas?|barras?|palos?|millon(?:es)?|melon(?:es)?|m|mill|pesos?)$/;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((piece, index) => {
      let raw = piece.replace(/^[¡¿"'«([{]+|[!?"'».,;:)\]}]+$/g, '');
      if (!raw) return;
      let norm = normalizeText(raw);
      if (norm.startsWith('$') && norm.length > 1) {
        tokens.push({ raw: '$', norm: '$', index, used: false });
        norm = norm.slice(1);
        raw = raw.slice(1);
      }
      const glued = UNIT_SUFFIX.exec(norm);
      if (glued) {
        tokens.push({ raw, norm: glued[1], index, used: false });
        tokens.push({
          raw: '',
          norm: glued[2],
          index,
          used: false,
          glued: true,
        });
        return;
      }
      tokens.push({ raw, norm, index, used: false });
    });
  return tokens;
}

function words(phrase: string): string[] {
  return phrase.split(' ').filter(Boolean);
}

/** ¿Empieza la frase en la posición i (solo palabras libres)? */
function phraseAt(tokens: Token[], i: number, phrase: string[]): boolean {
  if (i + phrase.length > tokens.length) return false;
  for (let k = 0; k < phrase.length; k++) {
    const t = tokens[i + k];
    if (t.used || t.norm !== phrase[k]) return false;
  }
  return true;
}

function markUsed(tokens: Token[], from: number, count: number) {
  for (let k = from; k < from + count; k++) tokens[k].used = true;
}

/** Busca la primera aparición libre de alguna de las frases (las más largas primero). */
function findPhrase(
  tokens: Token[],
  phrases: string[],
): { at: number; length: number; phrase: string } | null {
  const sorted = [...phrases].sort((a, b) => words(b).length - words(a).length);
  let best: { at: number; length: number; phrase: string } | null = null;
  for (const phrase of sorted) {
    const w = words(phrase);
    for (let i = 0; i < tokens.length; i++) {
      if (phraseAt(tokens, i, w)) {
        if (!best || i < best.at || (i === best.at && w.length > best.length))
          best = { at: i, length: w.length, phrase };
        break;
      }
    }
  }
  return best;
}

function singulars(word: string): string[] {
  const out = [word];
  if (word.length > 4 && word.endsWith('es')) out.push(word.slice(0, -2));
  if (word.length > 3 && word.endsWith('s')) out.push(word.slice(0, -1));
  return out;
}

// ---------- Diccionario de categorías ----------

type CategoryHit = {
  categoryId: string;
  kind: CategoryKindKey;
  merchant: string | null;
  fromUser: boolean;
};

type Dictionary = {
  /** frase o palabra → posibles categorías (una por tipo). */
  entries: Map<string, CategoryHit[]>;
  /** Las frases de más de una palabra. */
  phrases: string[];
};

function buildDictionary(ctx: ParseContext): Dictionary {
  const bySystemKey = new Map<string, ParseCategory>();
  for (const c of ctx.categories)
    if (c.systemKey) bySystemKey.set(c.systemKey, c);
  const entries = new Map<string, CategoryHit[]>();
  const add = (key: string, hit: CategoryHit) => {
    const k = normalizeKeyword(key);
    if (!k) return;
    const list = entries.get(k) ?? [];
    // Una sola por tipo: la primera que llega gana (las de la persona entran primero).
    if (!list.some((h) => h.kind === hit.kind)) list.push(hit);
    entries.set(k, list);
  };

  const categoryById = new Map(ctx.categories.map((c) => [c.id, c]));
  for (const kw of ctx.keywords) {
    if (!kw.categoryId) continue;
    const cat = categoryById.get(kw.categoryId);
    if (!cat) continue;
    add(kw.keyword, {
      categoryId: cat.id,
      kind: cat.kind,
      merchant: null,
      fromUser: true,
    });
  }

  for (const parent of SYSTEM_CATEGORIES) {
    const parentCat = bySystemKey.get(parent.key);
    const register = (
      seed: { key: string; words?: string[]; brands?: Record<string, string> },
      fallback: ParseCategory | undefined,
    ) => {
      const cat = bySystemKey.get(seed.key) ?? fallback;
      if (!cat) return;
      for (const w of seed.words ?? [])
        add(w, {
          categoryId: cat.id,
          kind: parent.kind,
          merchant: null,
          fromUser: false,
        });
      for (const [w, name] of Object.entries(seed.brands ?? {}))
        add(w, {
          categoryId: cat.id,
          kind: parent.kind,
          merchant: name,
          fromUser: false,
        });
    };
    // Las hijas primero: «almuerzo» lleva a Almuerzo y no solo a Comida afuera.
    for (const child of parent.children ?? []) register(child, parentCat);
    register(parent, undefined);
  }
  const phrases = [...entries.keys()].filter((k) => k.includes(' '));
  return { entries, phrases };
}

type CategoryMatches = {
  expense: CategoryHit | null;
  income: CategoryHit | null;
  merchant: string | null;
};

function matchCategories(tokens: Token[], dict: Dictionary): CategoryMatches {
  const result: CategoryMatches = {
    expense: null,
    income: null,
    merchant: null,
  };
  const take = (hits: CategoryHit[] | undefined) => {
    for (const hit of hits ?? []) {
      if (hit.kind === 'EXPENSE' && !result.expense) result.expense = hit;
      if (hit.kind === 'INCOME' && !result.income) result.income = hit;
      if (hit.merchant && !result.merchant) result.merchant = hit.merchant;
    }
  };
  // Primero las frases (de la persona y de FerFinance), en orden de aparición.
  const covered = new Set<number>();
  const phraseHits: { at: number; length: number; key: string }[] = [];
  for (const phrase of dict.phrases) {
    const w = words(phrase);
    for (let i = 0; i < tokens.length; i++) {
      if (phraseAt(tokens, i, w))
        phraseHits.push({ at: i, length: w.length, key: phrase });
    }
  }
  phraseHits.sort((a, b) => a.at - b.at || b.length - a.length);
  for (const h of phraseHits) {
    if ([...Array(h.length).keys()].some((k) => covered.has(h.at + k)))
      continue;
    for (let k = 0; k < h.length; k++) covered.add(h.at + k);
    take(dict.entries.get(h.key));
  }
  tokens.forEach((t, i) => {
    if (t.used || covered.has(i)) return;
    for (const form of singulars(t.norm)) {
      const hits = dict.entries.get(form);
      if (hits) {
        take(hits);
        break;
      }
    }
  });
  return result;
}

// ---------- Cuentas ----------

type AccountMention = {
  accountIds: string[];
  /** Palabra que la nombró: de un tipo de cuenta («tarjeta») o propia («nequi»). */
  byKind: boolean;
  role: 'from' | 'to' | 'via';
  at: number;
};

const FROM_WORDS = new Set(['de', 'desde', 'del']);
const TO_WORDS = new Set(['a', 'al', 'para', 'hacia']);
const VIA_WORDS = new Set(['en', 'con', 'por']);

function accountAliases(ctx: ParseContext): Map<string, string[]> {
  const aliases = new Map<string, string[]>();
  const add = (alias: string, id: string) => {
    const k = normalizeKeyword(alias);
    if (!k) return;
    const list = aliases.get(k) ?? [];
    if (!list.includes(id)) list.push(id);
    aliases.set(k, list);
  };
  for (const kw of ctx.keywords)
    if (kw.accountId) add(kw.keyword, kw.accountId);
  for (const a of ctx.accounts) {
    const name = normalizeKeyword(a.name);
    if (words(name).length <= 3) add(name, a.id);
    if (a.institution) add(a.institution, a.id);
    for (const w of words(name)) {
      if (w.length >= 2 && !GENERIC_ACCOUNT_WORDS.has(w) && !/^\d+$/.test(w))
        add(w, a.id);
    }
  }
  return aliases;
}

function findAccounts(tokens: Token[], ctx: ParseContext): AccountMention[] {
  const mentions: AccountMention[] = [];
  if (!ctx.accounts.length) return mentions;
  const aliases = accountAliases(ctx);
  const kindPhrases: { phrase: string; ids: string[] }[] = [];
  for (const [kind, list] of Object.entries(ACCOUNT_KIND_WORDS)) {
    const ids = ctx.accounts.filter((a) => a.kind === kind).map((a) => a.id);
    if (ids.length) for (const p of list) kindPhrases.push({ phrase: p, ids });
  }
  const candidates: { phrase: string; ids: string[]; byKind: boolean }[] = [
    ...[...aliases.entries()].map(([phrase, ids]) => ({
      phrase,
      ids,
      byKind: false,
    })),
    ...kindPhrases.map((k) => ({ ...k, byKind: true })),
  ].sort((a, b) => words(b.phrase).length - words(a.phrase).length);

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].used) continue;
    for (const c of candidates) {
      const w = words(c.phrase);
      if (!phraseAt(tokens, i, w)) continue;
      const prev = i > 0 && !tokens[i - 1].used ? tokens[i - 1].norm : null;
      let role: AccountMention['role'] = 'via';
      if (prev && FROM_WORDS.has(prev)) role = 'from';
      else if (prev && TO_WORDS.has(prev)) role = 'to';
      markUsed(tokens, i, w.length);
      if (
        prev &&
        (FROM_WORDS.has(prev) || TO_WORDS.has(prev) || VIA_WORDS.has(prev))
      )
        tokens[i - 1].used = true;
      mentions.push({ accountIds: c.ids, byKind: c.byKind, role, at: i });
      i += w.length - 1;
      break;
    }
  }
  return mentions;
}

// ---------- El lector ----------

export function parseMoneyText(
  text: string,
  ctx: ParseContext,
): ParsedMoneyText {
  const tokens = tokenize(text.slice(0, 500));
  const hints: string[] = [];

  // 1. El monto: la seguidilla con unidad («18 lucas») gana; si no hay, el número más grande.
  const spans: { from: number; to: number; reading: AmountReading }[] = [];
  const isNumberish = (t: Token) =>
    parseNumeric(t.norm) !== null || NUMBER_WORDS[t.norm] !== undefined;
  // «m» y «mill» solo valen pegadas al número («1.5m»); sueltas son otra cosa.
  const isUnit = (t: Token) =>
    (THOUSAND_UNITS.has(t.norm) ||
      MILLION_UNITS.has(t.norm) ||
      PESO_UNITS.has(t.norm)) &&
    (t.glued || !LOOSE_UNIT_EXCLUDED.has(t.norm));
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // «palo y medio», «luca y media» o «mil pesos» empiezan por la unidad.
    const starts =
      isNumberish(t) ||
      START_UNITS.has(t.norm) ||
      (t.norm === '$' && i + 1 < tokens.length && isNumberish(tokens[i + 1]));
    if (!starts) continue;
    let j = i;
    while (j + 1 < tokens.length) {
      const next = tokens[j + 1];
      if (isNumberish(next) || isUnit(next)) {
        j++;
        continue;
      }
      if (
        next.norm === 'y' &&
        j + 2 < tokens.length &&
        (isNumberish(tokens[j + 2]) || isUnit(tokens[j + 2]))
      ) {
        j++;
        continue;
      }
      break;
    }
    const span = tokens.slice(i, j + 1);
    const lone = span.length === 1 && WEAK_NUMBER_WORDS.has(span[0].norm);
    // «m» suelta no es millones (solo pegada: «1.5m»).
    const reading = lone ? null : readAmount(span.map((s) => s.norm));
    if (reading) spans.push({ from: i, to: j, reading });
    i = j;
  }
  let chosen = spans.find((s) => s.reading.hasUnit) ?? null;
  if (!chosen && spans.length)
    chosen = spans.reduce((best, s) =>
      s.reading.raw > best.reading.raw ? s : best,
    );
  if (chosen) markUsed(tokens, chosen.from, chosen.to - chosen.from + 1);
  const amount = chosen?.reading.value ?? null;
  const assumedThousands = chosen?.reading.assumedThousands ?? false;
  if (assumedThousands && amount !== null)
    hints.push(
      'Los números pequeños se toman como miles. Si eran pesos, escribe por ejemplo «500 pesos».',
    );

  // 2. La fecha.
  let date = ctx.todayKey;
  const before = findPhrase(tokens, ['antes de ayer']);
  if (before) {
    markUsed(tokens, before.at, before.length);
    date = shiftDays(ctx.todayKey, -2);
  }
  tokens.forEach((t, i) => {
    if (t.used) return;
    if (t.norm === 'hoy') t.used = true;
    else if (t.norm === 'ayer') {
      t.used = true;
      date = shiftDays(ctx.todayKey, -1);
    } else if (t.norm === 'antier' || t.norm === 'anteayer') {
      t.used = true;
      date = shiftDays(ctx.todayKey, -2);
    } else {
      const wd = WEEKDAYS.indexOf(t.norm);
      if (wd < 0) return;
      t.used = true;
      const today = new Date(ctx.todayKey + 'T00:00:00Z').getUTCDay();
      let back = (today - wd + 7) % 7;
      const next = tokens[i + 1];
      if (next && !next.used && next.norm === 'pasado') {
        next.used = true;
        if (back === 0) back = 7;
      }
      const prev = tokens[i - 1];
      if (prev && !prev.used && (prev.norm === 'el' || prev.norm === 'este'))
        prev.used = true;
      date = shiftDays(ctx.todayKey, -back);
    }
  });

  // 3. Lo que dice qué tipo de movimiento es.
  const card = findPhrase(tokens, CARD_PAYMENT_PHRASES);
  if (card) markUsed(tokens, card.at, card.length);
  const incomeCue = findPhrase(tokens, INCOME_PHRASES);
  if (incomeCue) markUsed(tokens, incomeCue.at, incomeCue.length);
  const flag = (list: string[]) => {
    let found = false;
    for (const t of tokens) {
      if (!t.used && list.includes(t.norm)) {
        t.used = true;
        found = true;
      }
    }
    return found;
  };
  const transferVerb = flag(TRANSFER_VERBS);
  const transferNoun = flag(TRANSFER_NOUNS);
  const withdraw = !incomeCue && flag(WITHDRAW_VERBS);
  const deposit = !incomeCue && flag(DEPOSIT_VERBS);
  const expenseCue = flag(EXPENSE_VERBS);

  // 4. Las cuentas que nombró (la misma cuenta nombrada dos veces cuenta una vez: «nu tarjeta»).
  const found = findAccounts(tokens, ctx);
  const named = new Set(
    found
      .filter((m) => !m.byKind && m.accountIds.length === 1)
      .map((m) => m.accountIds[0]),
  );
  const mentions = found.filter((m, k) => {
    if (m.byKind && m.accountIds.some((id) => named.has(id))) return false;
    if (m.accountIds.length !== 1) return true;
    return (
      found.findIndex(
        (o) => o.accountIds.length === 1 && o.accountIds[0] === m.accountIds[0],
      ) === k
    );
  });
  const transferCue =
    !incomeCue && (transferVerb || (transferNoun && mentions.length >= 1));
  const resolve = (
    m: AccountMention | undefined,
    exclude: string[] = [],
  ): string | null => {
    if (!m) return null;
    const ids = m.accountIds.filter((id) => !exclude.includes(id));
    if (!ids.length) return null;
    if (ids.length > 1 && m.byKind) {
      const named = ctx.accounts.find((a) => a.id === ids[0]);
      if (named)
        hints.push(
          `Tienes varias de ese tipo; elegí «${named.name}». Cámbiala si no era esa.`,
        );
    }
    return ids[0];
  };
  const kindOf = (id: string | null) =>
    ctx.accounts.find((a) => a.id === id)?.kind ?? null;
  const firstOfKind = (kind: string) =>
    ctx.accounts.find((a) => a.kind === kind)?.id ?? null;

  let type: ParsedType = 'EXPENSE';
  let accountId: string | null = null;
  let toAccountId: string | null = null;

  if (card) {
    type = 'TRANSFER';
    const cardMention = mentions.find((m) =>
      m.accountIds.some((id) => kindOf(id) === 'CREDIT_CARD'),
    );
    toAccountId = cardMention
      ? (cardMention.accountIds.find((id) => kindOf(id) === 'CREDIT_CARD') ??
        null)
      : firstOfKind('CREDIT_CARD');
    accountId = resolve(
      mentions.find((m) => m !== cardMention),
      toAccountId ? [toAccountId] : [],
    );
    if (!toAccountId)
      hints.push(
        'Para anotar el pago de la tarjeta, crea la tarjeta como una cuenta.',
      );
  } else if (withdraw || deposit) {
    type = 'TRANSFER';
    const cash = firstOfKind('CASH');
    const other = mentions.find((m) =>
      m.accountIds.some((id) => kindOf(id) !== 'CASH'),
    );
    const otherId = resolve(other, cash ? [cash] : []);
    if (withdraw) {
      accountId = otherId;
      toAccountId = cash;
    } else {
      accountId = cash;
      toAccountId = otherId;
    }
    if (!cash)
      hints.push(
        'Para anotar retiros y consignaciones, crea una cuenta de «Efectivo».',
      );
  } else if (incomeCue) {
    // «me transfirieron 200 a nequi»: entra a la cuenta de llegada (o a la única que nombró).
    accountId = resolve(
      mentions.find((m) => m.role === 'to') ?? mentions[mentions.length - 1],
    );
  } else if (transferCue || mentions.length >= 2) {
    type = 'TRANSFER';
    const from = mentions.find((m) => m.role === 'from');
    const to = mentions.find((m) => m.role === 'to');
    if (mentions.length >= 2) {
      const fromM = from ?? mentions.find((m) => m !== to) ?? mentions[0];
      const toM = to ?? mentions.find((m) => m !== fromM);
      accountId = resolve(fromM);
      toAccountId = resolve(toM, accountId ? [accountId] : []);
    } else if (mentions.length === 1) {
      if (from) accountId = resolve(from);
      else toAccountId = resolve(mentions[0]);
    }
  } else if (mentions.length) {
    accountId = resolve(mentions[0]);
  }

  // 5. Categoría y comercio (en lo que queda; las palabras siguen en la nota).
  const dict = buildDictionary(ctx);
  const matches =
    type === 'TRANSFER'
      ? { expense: null, income: null, merchant: null }
      : matchCategories(tokens, dict);
  if (type !== 'TRANSFER') {
    if (incomeCue) type = 'INCOME';
    else if (expenseCue) type = 'EXPENSE';
    else if (matches.income && !matches.expense) type = 'INCOME';
    else if (
      matches.income?.fromUser &&
      matches.expense &&
      !matches.expense.fromUser
    )
      type = 'INCOME';
    else type = 'EXPENSE';
  }
  const hit =
    type === 'INCOME'
      ? matches.income
      : type === 'EXPENSE'
        ? matches.expense
        : null;
  const categoryId = hit?.categoryId ?? null;
  const merchant = type === 'TRANSFER' ? null : matches.merchant;

  // 6. La nota: lo que sobra, sin rellenos en las puntas.
  const rest = tokens.filter((t) => !t.used && t.raw);
  while (rest.length && EDGE_FILLERS.has(rest[0].norm)) rest.shift();
  while (rest.length && EDGE_FILLERS.has(rest[rest.length - 1].norm))
    rest.pop();
  let note: string | null =
    rest
      .map((t) => t.raw)
      .join(' ')
      .trim() || null;
  if (note)
    note = (note.charAt(0).toLocaleUpperCase('es') + note.slice(1)).slice(
      0,
      300,
    );
  if (note && merchant && normalizeKeyword(note) === normalizeKeyword(merchant))
    note = null;

  // 7. Lo que no entendió, para enseñarlo.
  const unknown: string[] = [];
  if (!categoryId && type !== 'TRANSFER') {
    for (const t of rest) {
      const w = t.norm;
      if (
        w.length < 3 ||
        STOPWORDS.has(w) ||
        /\d/.test(w) ||
        unknown.includes(w)
      )
        continue;
      unknown.push(w);
      if (unknown.length === 3) break;
    }
  }

  return {
    type,
    amount,
    assumedThousands,
    date,
    accountId,
    toAccountId,
    categoryId,
    merchant,
    note,
    unknown,
    hints,
  };
}

/** La categoría que corresponde a un texto suelto (por ejemplo, la descripción de un ingreso viejo). */
export function categoryFromText(
  text: string,
  kind: CategoryKindKey,
  ctx: Pick<ParseContext, 'categories' | 'keywords'>,
): string | null {
  const tokens = tokenize(text.slice(0, 300));
  const dict = buildDictionary({
    todayKey: '2000-01-01',
    accounts: [],
    ...ctx,
  });
  const m = matchCategories(tokens, dict);
  return (kind === 'INCOME' ? m.income : m.expense)?.categoryId ?? null;
}
