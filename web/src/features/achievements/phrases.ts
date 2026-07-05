import frases from "../../data/frases_motivacionales.json";

export type MotivationalPhrase = {
  frase: string;
  autor: string;
};

const PHRASES = frases as MotivationalPhrase[];

const PHRASE_COUNT = PHRASES.length;

function randomIndex(max: number): number {
  if (max <= 0) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function pickPhraseByIndex(index: number): MotivationalPhrase {
  const safe = ((index % PHRASE_COUNT) + PHRASE_COUNT) % PHRASE_COUNT;
  return PHRASES[safe];
}

/** Elige una frase al azar de la coleccion. */
export function pickRandomPhrase(): MotivationalPhrase {
  return PHRASES[randomIndex(PHRASE_COUNT)];
}

export function randomPhraseIndex(): number {
  return randomIndex(PHRASE_COUNT);
}

export { PHRASES, PHRASE_COUNT };
