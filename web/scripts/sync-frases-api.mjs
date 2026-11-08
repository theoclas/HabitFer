// Copia las frases de la web (web/src/data/*.json) a la API, para el mensaje de la mañana.
// Uso (desde la raíz del repo):  node web/scripts/sync-frases-api.mjs
// Vuelve a correrlo si cambias las frases en la web.
import { readFileSync, writeFileSync } from "node:fs";

const read = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
const clean = (list) => {
  const seen = new Set();
  return list
    .map((p) => ({ frase: String(p.frase ?? "").trim(), autor: String(p.autor ?? "").trim() }))
    .filter((p) => p.frase && !seen.has(p.frase) && seen.add(p.frase));
};

const all = clean(read("frases_motivacionales.json"));
const friends = clean(read("frases_jhova_feristoteles_petlon.json"));
const out = new URL("../../api/src/reminders/phrases.data.ts", import.meta.url);

writeFileSync(
  out,
  `// Generado por web/scripts/sync-frases-api.mjs desde web/src/data (las frases del banner de la app).
// No editar a mano: cambia los JSON de la web y vuelve a correr el script.

export type Phrase = { frase: string; autor: string };

/** Jhova, Feristoteles y Petlon (las favoritas: el banner las muestra 70 % de las veces). */
export const FRIEND_PHRASES: Phrase[] = ${JSON.stringify(friends, null, 2)};

/** Coleccion principal. */
export const PHRASES: Phrase[] = ${JSON.stringify(all, null, 2)};
`,
);
console.log(`frases: ${friends.length} de amigos y ${all.length} en total → api/src/reminders/phrases.data.ts`);
