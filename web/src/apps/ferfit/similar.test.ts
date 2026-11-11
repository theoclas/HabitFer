import assert from "node:assert/strict";
import { test } from "node:test";
import { canDo, missingGear, similarTo, swapDose } from "./similar.ts";
import type { Exercise } from "./types.ts";

const ex = (key: string, o: Partial<Exercise>): Exercise =>
  ({
    key,
    name: key,
    focus: "fuerza",
    level: 1,
    impact: "bajo",
    equipment: [],
    muscles: ["piernas"],
    steps: [],
    figure: { view: "side", a: { head: [0, 0], lines: [], hands: [] }, b: null, props: [], weights: false, band: null, dur: 1 },
    ...o,
  }) as Exercise;

const ALL = [
  ex("sentadilla", { muscles: ["piernas", "gluteos"], easier: "sentadilla-silla", harder: "sentadilla-goblet" }),
  ex("sentadilla-silla", { muscles: ["piernas", "gluteos"], equipment: ["silla"], harder: "sentadilla" }),
  ex("sentadilla-goblet", { muscles: ["piernas", "gluteos", "abdomen"], equipment: ["mancuernas"], level: 2 }),
  ex("puente-gluteo", { muscles: ["gluteos", "piernas", "espalda"], equipment: ["colchoneta"] }),
  ex("zancada", { muscles: ["piernas", "gluteos"], level: 2 }),
  ex("flexion", { muscles: ["pecho", "triceps"] }),
  ex("marcha", { muscles: ["piernas", "cuerpo"], focus: "cardio" }),
];

test("con lo que hay en casa: la colchoneta y la pared no hacen falta", () => {
  assert.equal(canDo(ALL[3], []), true);
  assert.equal(canDo(ALL[2], ["silla"]), false);
  assert.equal(canDo(ALL[2], null), true);
  assert.deepEqual(missingGear([ALL[1], ALL[2], ALL[3]], ["silla"]), ["mancuernas"]);
  assert.deepEqual(missingGear([ALL[2]], null), []);
});

test("parecidos: primero las versiones, luego los mismos músculos; solo lo que se puede hacer", () => {
  assert.deepEqual(
    similarTo(ALL[0], ALL, null).map((e) => e.key),
    ["sentadilla-silla", "sentadilla-goblet", "puente-gluteo", "zancada"],
  );
  // Sin mancuernas ni silla, las versiones que las piden no salen.
  assert.deepEqual(
    similarTo(ALL[0], ALL, []).map((e) => e.key),
    ["puente-gluteo", "zancada"],
  );
  // Un ejercicio de pecho no sugiere ejercicios de piernas.
  assert.deepEqual(similarTo(ALL[5], ALL, null), []);
});

test("no cambia un ejercicio de fuerza por un estiramiento, y el más fácil va primero", () => {
  const list = [
    ex("flexion", { muscles: ["pecho", "triceps", "hombros"], level: 2, easier: "flexion-pared", harder: "flexion-pies" }),
    ex("flexion-pared", { muscles: ["pecho", "triceps", "hombros"], equipment: ["pared"], harder: "flexion" }),
    ex("flexion-pies", { muscles: ["pecho", "triceps", "hombros"], level: 3, easier: "flexion" }),
    ex("estiramiento-pecho", { muscles: ["pecho", "hombros"], focus: "estiramiento" }),
    ex("plancha", { muscles: ["abdomen", "hombros", "pecho"], focus: "core" }),
  ];
  assert.deepEqual(
    similarTo(list[0], list, null).map((e) => e.key),
    ["flexion-pared", "flexion-pies", "plancha"],
  );
  assert.deepEqual(similarTo(list[3], list, null), []);
});

test("al cambiar un ejercicio se queda la dosis si se mide igual", () => {
  assert.deepEqual(swapDose({ reps: 15, seconds: null }, { reps: 10 }), { reps: 15, seconds: null });
  assert.deepEqual(swapDose({ reps: null, seconds: 40 }, { seconds: 30 }), { reps: null, seconds: 40 });
  assert.deepEqual(swapDose({ reps: 15, seconds: null }, { seconds: 30 }), { reps: null, seconds: 30 });
  assert.deepEqual(swapDose({ reps: null, seconds: 40 }, { reps: 8 }), { reps: 8, seconds: null });
  assert.deepEqual(swapDose({ reps: null, seconds: 40 }, {}), { reps: 10, seconds: null });
});
