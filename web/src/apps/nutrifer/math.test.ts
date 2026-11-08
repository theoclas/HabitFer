// Pruebas de las cuentas de NutriFer en el teléfono. Corren con el runner de Node: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountOf,
  usualChoice,
  canPrep,
  gramsForGoal,
  gramsText,
  kcalText,
  mlText,
  nutrientGoals,
  oilText,
  previewAmount,
  quantityText,
  recipePreview,
  relativeDay,
  remaining,
  scale,
  shiftDay,
  suggestedOil,
} from "./math.ts";
import { defaultAmount, lastAmount, portionText } from "./format.ts";
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

const pechuga: FoodDetail = {
  ...arepa,
  id: "p",
  name: "Pollo, pechuga sin piel, cruda",
  category: "Carnes y derivados",
  per100: { kcal: 120, protein: 23.5, fat: 2.6, carbs: 0 },
  portions: [{ id: "filete", label: "Filete", grams: 150, isDefault: true }],
};

test("cómo se preparó: el aceite que suele llevar", () => {
  assert.equal(suggestedOil("COCIDO", 150), 0);
  assert.equal(suggestedOil("FRITO", 150), 15);
  assert.equal(suggestedOil("ASADO", 150), 5);
  assert.equal(suggestedOil("FRITO", 10), 2.5, "media cucharadita como mínimo");
  assert.equal(oilText(5), "1 cucharadita (5 g)");
  assert.equal(oilText(2.5), "½ cucharadita (2,5 g)");
  assert.equal(oilText(0), "Sin aceite");
});

test("solo se pregunta cómo se preparó lo que se cocina y no viene ya frito", () => {
  assert.equal(canPrep(pechuga), true);
  assert.equal(canPrep({ ...pechuga, name: "Pollo, pechuga sin piel, frita sin sal" }), false);
  assert.equal(canPrep({ ...pechuga, category: "Frutas y derivados" }), false);
  assert.equal(canPrep(bandeja), false);
  assert.equal(canPrep({ ...pechuga, source: "RECIPE" }), false);
  assert.equal(canPrep({ ...pechuga, category: null }), false);
});

test("el aceite suma 9 kcal por gramo", () => {
  const sin = previewAmount(pechuga, { portionId: "filete", quantity: 1 });
  const frita = previewAmount(pechuga, { portionId: "filete", quantity: 1, prep: "FRITO", oilGrams: 15 });
  assert.equal(frita.grams, sin.grams, "los gramos son del pollo");
  assert.equal(Math.round(frita.totals.kcal - sin.totals.kcal), 135);
  assert.equal(Math.round(frita.totals.fat - sin.totals.fat), 15);
});

test("anotar por meta: 30 g de proteína de pechuga", () => {
  assert.equal(gramsForGoal(pechuga.per100, "protein", 30), 128);
  assert.equal(gramsForGoal(pechuga.per100, "kcal", 300), 250);
  assert.equal(gramsForGoal(pechuga.per100, "carbs", 30), null, "la pechuga no tiene carbohidratos");
  assert.equal(gramsForGoal(pechuga.per100, "protein", 0), null);
});

test("receta: por porción y por el peso de la olla", () => {
  const items = [
    { per100: { kcal: 300, protein: 20, fat: 1, carbs: 50 }, grams: 500 },
    { per100: { kcal: 0, protein: 0, fat: 0, carbs: 0 }, grams: 1500 },
  ];
  const r = recipePreview(items, 4);
  assert.equal(r.weight, 2000);
  assert.equal(r.servingGrams, 500);
  assert.equal(r.perServing.kcal, 375);
  assert.equal(r.perServing.protein, 25);
  const pesada = recipePreview(items, 4, 1200);
  assert.equal(pesada.servingGrams, 300);
  assert.equal(pesada.perServing.kcal, 375, "pesar la olla no cambia las calorías de una porción");
});

test("agua y días", () => {
  assert.equal(mlText(300), "300 ml");
  assert.equal(mlText(2000), "2 L");
  assert.equal(mlText(1250), "1,25 L");
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(relativeDay("2026-11-08", "2026-11-08"), "hoy");
  assert.equal(relativeDay("2026-11-07", "2026-11-08"), "ayer");
  assert.equal(relativeDay("2026-11-03", "2026-11-08"), "el martes");
  assert.equal(relativeDay("2026-10-30", "2026-11-08"), "el 30 de oct.");
});

test("textos de las filas", () => {
  assert.deepEqual(lastAmount({ entryId: "e", portionLabel: "Pocillo tintero", quantity: 2, grams: 240, kcal: 10 }), { text: "2 × pocillo tintero · 240 g", kcal: 10 });
  assert.deepEqual(lastAmount({ entryId: "e", portionLabel: null, quantity: 1, grams: 128, kcal: 154 }), { text: "128 g", kcal: 154 });
  const r = { id: "a", name: "Arepa", category: null, source: "TCAC" as const, kcal100: 157, portion: { id: "peq", label: "Arepa pequeña", grams: 56 }, kcalPortion: 88, isDish: false };
  assert.deepEqual(defaultAmount(r), { text: "1 arepa pequeña · 56 g", kcal: 88 });
  assert.deepEqual(defaultAmount({ ...r, portion: null, kcalPortion: null }), { text: "100 g", kcal: 157 });
  // Una medida que ya dice el peso no se repite.
  assert.deepEqual(defaultAmount({ ...r, portion: { id: "c", label: "100 g", grams: 100 }, kcalPortion: 157 }), { text: "100 g", kcal: 157 });
  assert.deepEqual(lastAmount({ entryId: "e", portionLabel: "100 g", quantity: 1, grams: 100, kcal: 450 }), { text: "100 g", kcal: 450 });
  assert.deepEqual(lastAmount({ entryId: "e", portionLabel: "100 g", quantity: 2, grams: 200, kcal: 900 }), { text: "2 × 100 g · 200 g", kcal: 900 });
  assert.equal(portionText("2 huevos", 1), "2 huevos");
  assert.equal(portionText("2 huevos", 2), "2 × 2 huevos");
  assert.equal(portionText("Pocillo", 1.5), "1½ × pocillo");
});

test("metas de nutrientes: iguales a las del servidor", () => {
  assert.deepEqual(nutrientGoals(2000), { fiber: 28, sugar: 50, sodium: 2000 });
  assert.deepEqual(nutrientGoals(1500), { fiber: 25, sugar: 38, sodium: 2000 });
  assert.deepEqual(nutrientGoals(1830), { fiber: 26, sugar: 46, sodium: 2000 });
});

test("aprende tus porciones: el editor arranca con lo de la última vez", () => {
  assert.equal(usualChoice(arepa), undefined, "sin historia, la medida por defecto");
  const conMedida = usualChoice({ ...arepa, usual: { portionLabel: "Arepa pequeña", quantity: 2, grams: 112, prep: null, oilGrams: null, parts: null } });
  assert.deepEqual(conMedida, { portionId: "peq", quantity: 2, prep: null, oilGrams: null });
  const enGramos = usualChoice({ ...arepa, usual: { portionLabel: null, quantity: 1, grams: 120, prep: "ASADO", oilGrams: 5, parts: null } });
  assert.deepEqual(enGramos, { grams: 120, quantity: 1, prep: "ASADO", oilGrams: 5 });
  const plato = usualChoice({
    ...bandeja,
    usual: { portionLabel: "Plato", quantity: 1, grams: 150, prep: null, oilGrams: null, parts: [{ partId: "chich", label: "Chicharrón", foodId: "y", grams: 80, included: false }] },
  });
  assert.deepEqual(plato, { quantity: 1, parts: [{ partId: "chich", included: false }] });
});

test("cuánto en la revisión de «escribe o dicta»", () => {
  const a = amountOf(arepa, { portionId: "peq", quantity: 2, grams: null });
  assert.equal(a.grams, 112);
  assert.equal(Math.round(a.kcal), 176);
  const frita = amountOf(pechuga, { portionId: null, quantity: 1, grams: 100, oilGrams: 10 });
  assert.equal(Math.round(frita.kcal), 120 + 90);
});
