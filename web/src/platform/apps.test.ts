// Pruebas de la lista de apps (ProyecFer retirada). Corren con el runner de Node: npm test
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { ACTIVE_APP_IDS, APPS, LAST_APP_KEY, getLastApp, resolvePostLoginPath, setLastApp } from "./apps.ts";

// Node no trae localStorage: uno de mentiras en memoria.
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
});

beforeEach(() => store.clear());

test("ProyecFer está retirada y no se ofrece", () => {
  assert.equal(APPS.proyecfer.retired, true);
  assert.deepEqual(ACTIVE_APP_IDS, ["habitfer", "fernance", "nutrifer"]);
});

test("una última app retirada cuenta como ninguna y lleva al selector", () => {
  store.set(LAST_APP_KEY, "proyecfer");
  assert.equal(getLastApp(), null);
  assert.equal(resolvePostLoginPath(), "/app/picker");
});

test("las apps activas se recuerdan como antes", () => {
  setLastApp("nutrifer");
  assert.equal(getLastApp(), "nutrifer");
  assert.equal(resolvePostLoginPath(), "/app/nutrifer");
});

test("un valor raro o vacío no es ninguna app", () => {
  assert.equal(getLastApp(), null);
  store.set(LAST_APP_KEY, "basura");
  assert.equal(getLastApp(), null);
});
