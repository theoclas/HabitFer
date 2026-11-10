// Pruebas de cómo se mueven las flechas en el lanzador de apps. Corren con el runner de Node: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { verticalStep, wideFirst } from "./launcherGrid.ts";

/** A dónde lleva cada flecha desde cada tarjeta. */
function moves(total: number, dir: 1 | -1): number[] {
  return Array.from({ length: total }, (_, i) => verticalStep(i, dir, total));
}

test("con un número impar de apps la primera va a lo ancho", () => {
  assert.equal(wideFirst(1), true);
  assert.equal(wideFirst(2), false);
  assert.equal(wideFirst(3), true);
  assert.equal(wideFirst(4), false);
});

test("tres apps: la ancha arriba y dos abajo", () => {
  // [0 ancha] / [1, 2]
  assert.deepEqual(moves(3, 1), [1, 0, 0]);
  assert.deepEqual(moves(3, -1), [1, 0, 0]);
});

test("cuatro apps: dos filas de a dos, como antes", () => {
  // [0, 1] / [2, 3]
  assert.deepEqual(moves(4, 1), [2, 3, 0, 1]);
  assert.deepEqual(moves(4, -1), [2, 3, 0, 1]);
});

test("cinco apps: la ancha y dos filas de a dos", () => {
  // [0 ancha] / [1, 2] / [3, 4]
  assert.deepEqual(moves(5, 1), [1, 3, 4, 0, 0]);
  assert.deepEqual(moves(5, -1), [3, 0, 0, 1, 2]);
});

test("una o dos apps: las flechas no se salen", () => {
  assert.deepEqual(moves(1, 1), [0]);
  assert.deepEqual(moves(2, 1), [0, 1]);
  assert.deepEqual(moves(2, -1), [0, 1]);
});
