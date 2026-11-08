// Pruebas de la sesión que se renueva sola. Corren con el runner de Node: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenNeedsRenewal } from "./session.ts";

/** JWT de mentira (sin firma válida): basta para leer el cuerpo. */
function fakeToken(claims: Record<string, unknown>): string {
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
  return `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(claims))}.firma`;
}

const NOW = Date.UTC(2026, 10, 8, 15, 0, 0);
const NOW_S = NOW / 1000;
const HOUR = 3600;
const YEAR = 365 * 24 * HOUR;

test("sin token (solo la cookie) o ilegible: renovar", () => {
  assert.equal(tokenNeedsRenewal(null, NOW), true);
  assert.equal(tokenNeedsRenewal("no-es-un-jwt", NOW), true);
  assert.equal(tokenNeedsRenewal(fakeToken({ sub: "u1" }), NOW), true);
});

test("un token de los de 8 horas se cambia por uno de un año aunque sea nuevo", () => {
  assert.equal(tokenNeedsRenewal(fakeToken({ iat: NOW_S - 60, exp: NOW_S - 60 + 8 * HOUR }), NOW), true);
});

test("uno de un año recién sacado no se renueva", () => {
  assert.equal(tokenNeedsRenewal(fakeToken({ iat: NOW_S - 2 * HOUR, exp: NOW_S - 2 * HOUR + YEAR }), NOW), false);
  assert.equal(tokenNeedsRenewal(fakeToken({ iat: NOW_S - 11 * HOUR, exp: NOW_S - 11 * HOUR + YEAR }), NOW), false);
});

test("con 12 horas o más, se renueva (un año más desde hoy)", () => {
  assert.equal(tokenNeedsRenewal(fakeToken({ iat: NOW_S - 12 * HOUR, exp: NOW_S - 12 * HOUR + YEAR }), NOW), true);
  assert.equal(tokenNeedsRenewal(fakeToken({ iat: NOW_S - 200 * 24 * HOUR, exp: NOW_S - 200 * 24 * HOUR + YEAR }), NOW), true);
});
