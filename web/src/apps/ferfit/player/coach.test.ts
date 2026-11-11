import assert from "node:assert/strict";
import { test } from "node:test";
import { pickVoice } from "./coach.ts";

test("se escoge la voz en español más cercana a Colombia", () => {
  const v = (lang: string) => ({ lang, name: lang });
  assert.equal(pickVoice([v("en-US"), v("es-ES"), v("es-MX"), v("es_CO")])?.lang, "es_CO");
  assert.equal(pickVoice([v("es-ES"), v("es-US")])?.lang, "es-US");
  assert.equal(pickVoice([v("es-AR")])?.lang, "es-AR");
  assert.equal(pickVoice([v("en-US"), v("fr-FR")]), null);
});
