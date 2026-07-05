import frasesOriginales from "../../data/frases_motivacionales.json";
import frasesJhovaFeristotelesPetlon from "../../data/frases_jhova_feristoteles_petlon.json";

export type MotivationalPhrase = {
  frase: string;
  autor: string;
};

/** Coleccion principal: logros de racha siempre usan estas frases. */
const PHRASES = frasesOriginales as MotivationalPhrase[];

/** Coleccion Jhova / Feristoteles / Petlon: solo banner al abrir HabitFer. */
const BANNER_PHRASES_ALT = frasesJhovaFeristotelesPetlon as MotivationalPhrase[];

const PHRASE_COUNT = PHRASES.length;

const BANNER_ALT_WEIGHT = 0.7;

function randomIndex(max: number): number {
  if (max <= 0) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function randomUnit(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0xffffffff;
  }
  return Math.random();
}

/** Logros de racha: siempre frases originales (indice guardado en API). */
export function pickPhraseByIndex(index: number): MotivationalPhrase {
  const safe = ((index % PHRASE_COUNT) + PHRASE_COUNT) % PHRASE_COUNT;
  return PHRASES[safe];
}

/** Banner HabitFer: 70% Jhova/Feristoteles/Petlon, 30% originales. */
export function pickRandomBannerPhrase(): MotivationalPhrase {
  const pool = randomUnit() < BANNER_ALT_WEIGHT ? BANNER_PHRASES_ALT : PHRASES;
  return pool[randomIndex(pool.length)];
}

/** Indice aleatorio solo para logros (coleccion original). */
export function randomPhraseIndex(): number {
  return randomIndex(PHRASE_COUNT);
}

export { PHRASES, PHRASE_COUNT };
