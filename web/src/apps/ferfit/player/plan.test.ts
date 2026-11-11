import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlan, defaultLog, mostlyGentle, planSeconds, planSignature, summarize, type ExerciseInfo, type PlanItem, type PlanOptions } from "./plan.ts";

const EX: Record<string, ExerciseInfo> = {
  marcha: { name: "Marcha en el sitio" },
  sentadilla: { name: "Sentadilla" },
  "zancada-atras": { name: "Zancada hacia atrás", perSide: true },
  "plancha-antebrazos": { name: "Plancha en antebrazos" },
  "estiramiento-isquios": { name: "Estiramiento de la parte de atrás del muslo", perSide: true },
  nino: { name: "Postura del niño" },
};
const info = (k: string) => EX[k];
const item = (key: string, sets: number, reps: number | null, seconds: number | null, rest: number): PlanItem => ({ key, sets, reps, seconds, rest });
const NORMAL: PlanOptions = { warmup: false, cooldown: false, mode: "normal", work: 40, rest: 20, rounds: 3 };
const BLOCKS = {
  warmup: [item("marcha", 1, null, 45, 10)],
  cooldown: [item("estiramiento-isquios", 1, null, 30, 8), item("nino", 1, null, 40, 0)],
};
const shape = (steps: ReturnType<typeof buildPlan>) => steps.map((s) => `${s.kind}:${s.key}:${s.timed ? s.seconds : `r${s.reps}`}`);

test("por series: prepárate, series con descanso y cambio de ejercicio", () => {
  const steps = buildPlan({ circuit: false, rounds: 1, items: [item("sentadilla", 2, 12, null, 45), item("plancha-antebrazos", 1, null, 30, 0)] }, NORMAL, info);
  assert.deepEqual(shape(steps), [
    "prep:sentadilla:10",
    "work:sentadilla:r12",
    "rest:sentadilla:45",
    "work:sentadilla:r12",
    "rest:plancha-antebrazos:45",
    "work:plancha-antebrazos:30",
  ]);
  assert.equal(steps[1].label, "Serie 1 de 2");
  assert.equal(steps[1].item, 0);
  assert.equal(steps[2].item, null);
  assert.equal(steps[0].say, "Prepárate. Empezamos con sentadilla.");
  assert.equal(steps[1].say, "¡Vamos! 12 repeticiones.");
  assert.equal(steps[2].say, "Descanso de 45 segundos.");
  assert.equal(steps[4].say, "Descanso de 45 segundos. Sigue: plancha en antebrazos.");
  assert.equal(steps[5].pos, 2);
  assert.equal(steps[5].count, 2);
});

test("sin descanso entre ejercicios hay un cambio de 10 s; lo que es por lado cuenta doble", () => {
  const steps = buildPlan({ circuit: false, rounds: 1, items: [item("estiramiento-isquios", 1, null, 30, 0), item("nino", 1, null, 40, 0)] }, NORMAL, info);
  assert.deepEqual(steps.map((s) => `${s.kind}:${s.seconds}`), ["prep:10", "work:60", "rest:10", "work:40"]);
  assert.equal(steps[1].say, "¡Vamos! Primer lado.");
  assert.equal(steps[2].say, "Sigue: postura del niño.");
  const reps = buildPlan({ circuit: false, rounds: 1, items: [item("zancada-atras", 1, 8, null, 0)] }, NORMAL, info);
  assert.equal(reps[1].say, "¡Vamos! 8 repeticiones por lado.");
});

test("circuito: vueltas con el descanso de cada ejercicio", () => {
  const steps = buildPlan({ circuit: true, rounds: 2, items: [item("marcha", 1, null, 40, 20), item("sentadilla", 1, 12, null, 60)] }, NORMAL, info);
  const work = steps.filter((s) => s.kind === "work");
  assert.deepEqual(
    work.map((s) => `${s.key}:${s.label}`),
    ["marcha:Vuelta 1 de 2", "sentadilla:Vuelta 1 de 2", "marcha:Vuelta 2 de 2", "sentadilla:Vuelta 2 de 2"],
  );
  assert.deepEqual(steps.filter((s) => s.kind === "rest").map((s) => s.seconds), [20, 60, 20]);
});

test("intervalos: todo por tiempo con el mismo trabajo y descanso", () => {
  const steps = buildPlan(
    { circuit: false, rounds: 1, items: [item("sentadilla", 3, 12, null, 45), item("marcha", 1, null, 60, 0)] },
    { ...NORMAL, mode: "intervals", work: 20, rest: 10, rounds: 2 },
    info,
  );
  const work = steps.filter((s) => s.kind === "work");
  assert.equal(work.length, 4);
  assert.ok(work.every((s) => s.timed && s.seconds === 20 && s.reps === null));
  assert.deepEqual(steps.filter((s) => s.kind === "rest").map((s) => s.seconds), [10, 10, 10]);
});

test("cada minuto: un minuto por ejercicio, sin pasos de descanso", () => {
  const steps = buildPlan(
    { circuit: false, rounds: 1, items: [item("sentadilla", 3, 12, null, 45), item("plancha-antebrazos", 1, null, 30, 0)] },
    { ...NORMAL, mode: "emom", rounds: 2 },
    info,
  );
  assert.deepEqual(steps.map((s) => s.kind), ["prep", "work", "work", "work", "work"]);
  assert.equal(steps[1].seconds, 60);
  assert.equal(steps[1].reps, 12);
  assert.equal(steps[2].goalSeconds, 30);
  assert.equal(steps[4].label, "Minuto 4 de 4");
  assert.equal(steps[1].say, "¡Vamos! 12 repeticiones, y descansa lo que quede del minuto.");
});

test("calentar y estirar se agregan con un cambio de 15 s entre bloques", () => {
  const steps = buildPlan({ circuit: false, rounds: 1, items: [item("sentadilla", 1, 10, null, 30)] }, { ...NORMAL, warmup: true, cooldown: true }, info, BLOCKS);
  assert.deepEqual(
    steps.map((s) => `${s.kind}:${s.block}:${s.seconds}`),
    ["prep:warmup:10", "work:warmup:45", "rest:main:15", "work:main:0", "rest:cooldown:30", "work:cooldown:60", "rest:cooldown:8", "work:cooldown:40"],
  );
  assert.equal(steps[0].say, "Prepárate para calentar. Primero: marcha en el sitio.");
  assert.equal(steps[2].say, "Bien. Ahora sí, la rutina. Primero: sentadilla.");
  assert.equal(steps[4].say, "¡Terminaste la rutina! Ahora a estirar. Primero: estiramiento de la parte de atrás del muslo.");
  assert.equal(steps[1].label, "Calentamiento 1 de 1");
  assert.equal(steps[1].item, null);
});

test("ejercicios que ya no existen se saltan; sin ejercicios no hay plan", () => {
  const steps = buildPlan({ circuit: false, rounds: 1, items: [item("no-existe", 3, 10, null, 30), item("sentadilla", 1, 10, null, 30)] }, NORMAL, info);
  assert.equal(steps.filter((s) => s.kind === "work").length, 1);
  assert.equal(steps[1].item, 1);
  assert.deepEqual(buildPlan({ circuit: false, rounds: 1, items: [item("no-existe", 1, 5, null, 0)] }, NORMAL, info, BLOCKS), []);
});

test("al terminar se guardan los ejercicios de la rutina con sus series, sin calentar ni estirar", () => {
  const steps = buildPlan(
    { circuit: false, rounds: 1, items: [item("sentadilla", 2, 12, null, 30), item("estiramiento-isquios", 1, null, 30, 0)] },
    { ...NORMAL, warmup: true },
    info,
    BLOCKS,
  );
  // 0 prep · 1 marcha (calentar) · 2 cambio · 3 sentadilla 1 · 4 descanso · 5 sentadilla 2 · 6 cambio · 7 isquios
  assert.deepEqual(steps.map((s) => s.kind), ["prep", "work", "rest", "work", "rest", "work", "rest", "work"]);
  const sum = summarize(steps, [7, 1, 3, 5], { 3: { reps: 10, seconds: null, weight: 4 } });
  assert.deepEqual(sum.addDone, [0, 1]);
  assert.deepEqual(sum.logs, [
    { index: 0, sets: [{ reps: 10, seconds: null, weight: 4 }, { reps: 12, seconds: null, weight: null }] },
    { index: 1, sets: [{ reps: null, seconds: 30, weight: null }] },
  ]);
  assert.equal(sum.exercises, 2);
  assert.equal(sum.sets, 3);
  assert.deepEqual(defaultLog(steps[7]), { reps: null, seconds: 30, weight: null });
});

test("tiempo, huella y rutinas suaves", () => {
  const a = buildPlan({ circuit: false, rounds: 1, items: [item("sentadilla", 2, 10, null, 30)] }, NORMAL, info);
  assert.equal(planSeconds(a), 10 + 30 + 30 + 30);
  const b = buildPlan({ circuit: false, rounds: 1, items: [item("sentadilla", 2, 12, null, 30)] }, NORMAL, info);
  assert.notEqual(planSignature(a), planSignature(b));
  assert.equal(planSignature(a), planSignature(buildPlan({ circuit: false, rounds: 1, items: [item("sentadilla", 2, 10, null, 30)] }, NORMAL, info)));
  assert.equal(mostlyGentle(["estiramiento", "movilidad", "fuerza"]), true);
  assert.equal(mostlyGentle(["fuerza", "cardio", "estiramiento"]), false);
});
