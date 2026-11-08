// Pruebas de las cuentas de NutriFer en el teléfono. Corren con el runner de Node: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { gramsText, kcalText, previewAmount, quantityText, remaining, scale } from "./math.ts";
import type { FoodDetail } from "./types.ts";

const arepa: FoodDetail = {
  id: "a",
  name: "Arepa",
  category: null,
  brand: null,
  source: "TCAC",
  sourceLabel: "",
  own: false,
  per100: { kcal: 157, protein: 3.4, fat: 1.1, carbs: 33 },
  extra: [],
  portions: [{ id: "peq", label: "Arepa pequeña", grams: 56, isDefault: true }],
  parts: [],
};

const bandeja: FoodDetail = {
  ...arepa,
  id: "b",
  name: "Bandeja",
  source: "DISH",
  portions: [{ id: "plato", label: "Plato", grams: 230, isDefault: true }],
  parts: [
    { id: "arroz", label: "Arroz", grams: 150, foodId: "x", foodName: "Arroz", per100: { kcal: 130, protein: 2.7, fat: 0.3, carbs: 28 } },
    { id: "chich", label: "Chicharrón", grams: 80, foodId: "y", foodName: "Chicharrón", per100: { kcal: 573, protein: 20, fat: 54, carbs: 0 } },
  ],
};

test("scale y medidas", () => {
  assert.equal(Math.round(scale(arepa.per100, 56).kcal), 88);
  const two = previewAmount(arepa, { portionId: "peq", quantity: 2 });
  assert.equal(two.grams, 112);
  assert.equal(Math.round(two.totals.kcal), 176);
  assert.equal(previewAmount(arepa, { grams: 120, quantity: 1 }).grams, 120);
});

test("plato por partes: quitar el chicharrón", () => {
  assert.equal(Math.round(previewAmount(bandeja, { quantity: 1 }).totals.kcal), 653);
  const sin = previewAmount(bandeja, { quantity: 1, parts: [{ partId: "chich", included: false }] });
  assert.equal(sin.grams, 150);
  assert.equal(Math.round(sin.totals.kcal), 195);
});

test("textos", () => {
  assert.equal(kcalText(1437.4), "1.437");
  assert.equal(gramsText(12.46), "12,5");
  assert.equal(quantityText(0.5), "½");
  assert.equal(quantityText(1.5), "1½");
  assert.equal(quantityText(2), "2");
  assert.equal(remaining(2000, 1437.6), 562);
});
