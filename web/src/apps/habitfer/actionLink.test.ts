// Pruebas del enlace «Hecho» de los correos. Corren con el runner de Node: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultLabel, describeResult, parseActionHash } from "./actionLink.ts";

/** JWT de mentira (sin firma válida): basta para leer el cuerpo. */
function fakeToken(claims: Record<string, unknown>): string {
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
  return `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(claims))}.firma`;
}

const NOW = Date.UTC(2026, 10, 8, 15, 0, 0);
const IN_ONE_HOUR = Math.floor(NOW / 1000) + 3600;

test("lee token, título y botón del fragmento", () => {
  const token = fakeToken({ sub: "u1", act: "habit-add", tid: "h1", d: "2026-11-08", exp: IN_ONE_HOUR, typ: "push-action" });
  const hash = "#" + new URLSearchParams({ t: token, n: "Leer 20 min", l: "Sumar 10 minutos" }).toString();
  const link = parseActionHash(hash, NOW);
  assert.ok(link);
  assert.equal(link.token, token);
  assert.equal(link.title, "Leer 20 min");
  assert.equal(link.label, "Sumar 10 minutos");
  assert.equal(link.act, "habit-add");
  assert.equal(link.date, "2026-11-08");
  assert.equal(link.expired, false);
});

test("los espacios codificados como + se leen como espacios (así los arma la API)", () => {
  const link = parseActionHash("#t=abc.def.ghi&n=Tomar+agua&l=Marcar+como+hecho", NOW);
  assert.equal(link?.title, "Tomar agua");
  assert.equal(link?.label, "Marcar como hecho");
  assert.equal(link?.source, "mail");
});

test("el enlace corto de WhatsApp llega con s=wa", () => {
  assert.equal(parseActionHash("#t=abc.def.ghi&n=Leer&l=Marcar+como+hecho&s=wa", NOW)?.source, "whatsapp");
});

test("sin token no hay enlace", () => {
  assert.equal(parseActionHash("", NOW), null);
  assert.equal(parseActionHash("#n=Leer", NOW), null);
  assert.equal(parseActionHash("#t=%20%20", NOW), null);
});

test("un token vencido se marca como vencido", () => {
  const token = fakeToken({ act: "task-done", exp: Math.floor(NOW / 1000) - 60 });
  assert.equal(parseActionHash(`#t=${token}`, NOW)?.expired, true);
});

test("un token raro no rompe: sin acción ni fecha, y no se da por vencido", () => {
  const link = parseActionHash("#t=esto-no-es-un-jwt", NOW);
  assert.ok(link);
  assert.equal(link.act, null);
  assert.equal(link.date, null);
  assert.equal(link.expired, false);
  const weird = parseActionHash(`#t=${fakeToken({ act: "borrar-todo", d: "ayer" })}`, NOW);
  assert.equal(weird?.act, null);
  assert.equal(weird?.date, null);
});

test("título y botón con tildes y emojis", () => {
  const hash = "#" + new URLSearchParams({ t: "a.b.c", n: "Meditación 🧘", l: "Marcar como hecho" }).toString();
  assert.equal(parseActionHash(hash, NOW)?.title, "Meditación 🧘");
});

test("textos por defecto del botón", () => {
  assert.equal(defaultLabel("task-done"), "Marcar como hecha");
  assert.equal(defaultLabel("habit-add"), "Sumar");
  assert.equal(defaultLabel("habit-done"), "Marcar como hecho");
  assert.equal(defaultLabel(null), "Marcar como hecho");
});

test("resultado: hábito con racha, medible, logro y tarea", () => {
  assert.deepEqual(describeResult({ ok: true, kind: "habit", title: "Leer", streak: 5, streakUnit: "days" }), {
    title: "✓ Leer",
    body: "Racha de 5 días 🔥",
    trophy: false,
  });
  assert.deepEqual(describeResult({ ok: true, kind: "habit", title: "Correr", streak: 3, streakUnit: "weeks" }).body, "Racha de 3 semanas 🔥");
  assert.deepEqual(describeResult({ ok: true, kind: "habit", title: "Leer", streak: 1 }).body, "¡Bien hecho!");
  assert.deepEqual(describeResult({ ok: true, kind: "habit", title: "Agua", done: false, message: "3 de 8 vasos" }), {
    title: "Agua",
    body: "3 de 8 vasos",
    trophy: false,
  });
  assert.equal(describeResult({ ok: true, kind: "habit", title: "Agua", done: true, message: "8 de 8 vasos · meta cumplida" }).title, "✓ Agua");
  assert.deepEqual(
    describeResult({ ok: true, kind: "habit", title: "Leer", achievement: { days: 30, label: "Un mes", headline: "30 días seguidos" } }),
    { title: "🏆 Logro desbloqueado", body: "Leer · 30 días seguidos · «Un mes»", trophy: true },
  );
  assert.deepEqual(describeResult({ ok: true, kind: "task", title: "Llamar a Juan" }), {
    title: "✓ Llamar a Juan",
    body: "Tarea completada.",
    trophy: false,
  });
});
