import assert from "node:assert/strict";
import { test } from "node:test";
import { clock, dayLabel, dayTitle, doseText, effortText, lastText, minutesText, restText, shiftDay, todayKey, weekRange, weekdayName } from "./format.ts";

test("la semana", () => {
  assert.equal(weekdayName("2026-11-11"), "miércoles");
  assert.equal(dayTitle("2026-11-09"), "Lunes 9");
  assert.equal(weekRange("2026-11-09", "2026-11-15"), "9 al 15 de noviembre");
  assert.equal(weekRange("2026-11-30", "2026-12-06"), "30 de noviembre al 6 de diciembre");
});

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

test("reloj, última vez y esfuerzo", () => {
  assert.equal(clock(65_000), "1:05");
  assert.equal(clock(400), "0:01");
  assert.equal(clock(400, "down"), "0:00");
  assert.equal(clock(-5), "0:00");
  assert.equal(lastText([{ reps: 12, seconds: null, weight: 5 }, { reps: 10, seconds: null, weight: 5 }]), "12 · 10 rep · 5 kg");
  assert.equal(lastText([{ reps: 12, seconds: null, weight: 5 }, { reps: 10, seconds: null, weight: 7.5 }]), "12 · 10 rep · hasta 7,5 kg");
  assert.equal(lastText([{ reps: null, seconds: 30, weight: null }, { reps: null, seconds: 25, weight: null }]), "30 s · 25 s");
  assert.equal(lastText([]), "");
  assert.equal(effortText(6), "Esfuerzo 6/10 · moderado");
});
