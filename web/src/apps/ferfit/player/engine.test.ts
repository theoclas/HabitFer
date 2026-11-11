import assert from "node:assert/strict";
import { test } from "node:test";
import { activeTime, addTime, back, complete, frozen, leftMs, pause, resume, skip, start, stepElapsed, tick } from "./engine.ts";
import type { Step } from "./plan.ts";

const step = (kind: Step["kind"], timed: boolean, seconds: number, reps: number | null = null): Step => ({
  kind,
  block: "main",
  key: "sentadilla",
  item: kind === "work" ? 0 : null,
  set: 1,
  sets: 1,
  pos: 1,
  count: 1,
  timed,
  seconds,
  reps,
  goalSeconds: null,
  perSide: false,
  emom: false,
  label: "",
  say: "",
});
// Prepárate 10 s, trabajo 30 s, descanso 15 s, trabajo por repeticiones, descanso 20 s, trabajo 30 s.
const STEPS = [step("prep", true, 10), step("work", true, 30), step("rest", true, 15), step("work", false, 0, 12), step("rest", true, 20), step("work", true, 30)];

test("los pasos con tiempo se encadenan sin atrasarse y esperan en los de repeticiones", () => {
  let c = start(STEPS, 0);
  assert.equal(c.state.index, 0);
  c = tick(c.state, STEPS, 9_900);
  assert.equal(c.state.index, 0);
  assert.equal(leftMs(c.state, 9_900), 100);
  // La app estuvo en segundo plano: al volver se pone al día.
  c = tick(c.state, STEPS, 70_000);
  assert.equal(c.state.index, 3);
  assert.deepEqual(c.started, [1, 2, 3]);
  assert.deepEqual(c.completed, [1]);
  assert.equal(c.state.stepStart, 55_000);
  assert.equal(stepElapsed(c.state, 70_000), 15_000);
});

test("Listo cuenta el ejercicio; saltar no; al final queda terminado con su tiempo activo", () => {
  let c = start(STEPS, 0, { index: 3 });
  c = complete(c.state, STEPS, 20_000);
  assert.deepEqual(c.completed, [3]);
  assert.equal(c.state.index, 4);
  c = skip(c.state, STEPS, 21_000);
  assert.equal(c.state.index, 5);
  c = skip(c.state, STEPS, 22_000);
  assert.equal(c.state.status, "finished");
  assert.deepEqual(c.state.done, [3]);
  assert.equal(activeTime(c.state, 99_000), 22_000);
});

test("al terminar solo, el tiempo activo llega hasta el final del último paso", () => {
  const c = tick(start(STEPS, 0, { index: 5 }).state, STEPS, 500_000);
  assert.equal(c.state.status, "finished");
  assert.deepEqual(c.completed, [5]);
  assert.equal(activeTime(c.state, 500_000), 30_000);
});

test("la pausa congela el tiempo y lo corre al seguir", () => {
  const c = start(STEPS, 0, { index: 1 });
  let s = pause(c.state, 10_000);
  assert.equal(leftMs(s, 50_000), 20_000);
  assert.equal(stepElapsed(s, 50_000), 10_000);
  s = resume(s, 60_000);
  assert.equal(leftMs(s, 65_000), 15_000);
  assert.equal(stepElapsed(s, 65_000), 15_000);
  assert.equal(activeTime(s, 65_000), 15_000);
  const after = tick(s, STEPS, 80_000);
  assert.equal(after.state.index, 2);
  assert.equal(after.state.stepStart, 80_000);
});

test("saltar en pausa deja el siguiente en pausa con su tiempo completo", () => {
  const c = start(STEPS, 0, { index: 1 });
  const s = skip(pause(c.state, 5_000), STEPS, 6_000).state;
  assert.equal(s.status, "paused");
  assert.equal(s.index, 2);
  assert.equal(leftMs(s, 99_000), 15_000);
});

test("atrás repite el ejercicio o vuelve al anterior, y deshace lo marcado desde ahí", () => {
  let c = start(STEPS, 0, { index: 3, done: [1] });
  c = back(c.state, STEPS, 1_000);
  assert.equal(c.state.index, 1);
  assert.deepEqual(c.undone, [1]);
  assert.deepEqual(c.state.done, []);
  c = back(c.state, STEPS, 6_000);
  assert.equal(c.state.index, 1);
  assert.equal(c.state.stepStart, 6_000);
  c = back(start(STEPS, 0).state, STEPS, 500);
  assert.equal(c.state.index, 0);
});

test("+10 s alarga el paso; guardar a medias lo deja en pausa", () => {
  const c = start(STEPS, 0, { index: 2 });
  let s = addTime(c.state, STEPS, 10_000);
  assert.equal(leftMs(s, 5_000), 20_000);
  assert.equal(s.durMs, 25_000);
  s = frozen(s, 5_000);
  assert.equal(s.status, "paused");
  assert.equal(leftMs(s, 99_000), 20_000);
  assert.equal(JSON.parse(JSON.stringify(s)).index, 2);
});
