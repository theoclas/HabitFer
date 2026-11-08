// Genera dist/sw.js desde sw/sw.template.js despues de `vite build`:
// pone la version (hash del contenido) y la lista de archivos que se guardan en cache.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const template = readFileSync(join(root, "sw", "sw.template.js"), "utf8");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// Fuera de la cache inicial: el propio sw, mapas de fuentes, pantallas de arranque de iPhone
// (iOS las pide solo al instalar), la imagen grande del login y el lector de códigos de barras
// (WebAssembly, ~1 MB: se baja la primera vez que se escanea y desde ahí queda en la cache).
const SKIP = [/^sw\.js$/, /\.map$/, /^icons\/splash-/, /^fersua-auth-hero\.png$/, /\.wasm$/];

const files = walk(dist)
  .map((p) => relative(dist, p).split(sep).join("/"))
  .filter((f) => !SKIP.some((re) => re.test(f)))
  .sort();

const hash = createHash("sha256");
for (const f of files) {
  hash.update(f);
  hash.update(readFileSync(join(dist, f)));
}
const version = hash.digest("hex").slice(0, 12);
const precache = files.map((f) => `/${f}`);

if (!template.includes("__HF_VERSION__") || !template.includes("__HF_PRECACHE__")) {
  throw new Error("sw.template.js no tiene los marcadores __HF_VERSION__ / __HF_PRECACHE__");
}
const out = template.replace("__HF_VERSION__", version).replace("__HF_PRECACHE__", JSON.stringify(precache, null, 2));
writeFileSync(join(dist, "sw.js"), out);

const kb = files.reduce((s, f) => s + statSync(join(dist, f)).size, 0) / 1024;
console.log(`sw.js: versión ${version}, ${precache.length} archivos en caché (${Math.round(kb)} KB)`);
