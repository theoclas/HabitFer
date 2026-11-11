import assert from "node:assert/strict";
import { test } from "node:test";
import { dayLabel, doseText, minutesText, restText, shiftDay, todayKey } from "./format.ts";

test("series y repeticiones", () => {
  assert.equal(doseText({ sets: 3, reps: 12 }), "3 × 12");
  assert.equal(doseText({ sets: 3, seconds: 30 }), "3 × 30 s");
  assert.equal(doseText({ sets: 2, reps: 8 }, true), "2 × 8 por lado");
  assert.equal(doseText({ sets: 1, seconds: 60 }), "60 s");
  assert.equal(doseText({ sets: 3, reps: 12 }, false, true), "12");
});

test("descansos y minutos", () => {
  assert.equal(restText(0), "Sin descanso");
  assert.equal(restText(45), "Descanso de 45 s");
  assert.equal(restText(90), "Descanso de 1 min 30 s");
  assert.equal(restText(120), "Descanso de 2 min");
  assert.equal(minutesText(25), "25 min");
  assert.equal(minutesText(75), "1 h 15 min");
});

test("días", () => {
  assert.equal(todayKey(new Date(2026, 10, 10, 22, 30)), "2026-11-10");
  assert.equal(shiftDay("2026-11-01", -1), "2026-10-31");
  assert.equal(dayLabel("2026-11-10", "2026-11-10"), "Hoy");
  assert.equal(dayLabel("2026-11-09", "2026-11-10"), "Ayer");
  assert.equal(dayLabel("2026-11-03", "2026-11-10"), "martes 3 de noviembre");
});
