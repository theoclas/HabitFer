// Pruebas de la captura rapida. Corren con el runner de Node: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuickTask } from "./parseQuickTask.ts";

// 8 de noviembre de 2026 es domingo; las 10:00 a. m.
const NOW = { todayKey: "2026-11-08", minutes: 10 * 60 };
const PROJECTS = [
  { id: "p1", name: "Música" },
  { id: "p2", name: "Trabajo" },
];

test("mañana 3pm llamar a Juan !alta", () => {
  const t = parseQuickTask("mañana 3pm llamar a Juan !alta", NOW);
  assert.equal(t.title, "Llamar a Juan");
  assert.equal(t.dueDate, "2026-11-09");
  assert.equal(t.dueTime, "15:00");
  assert.equal(t.priority, "HIGH");
  assert.equal(t.reminderEnabled, true);
  assert.deepEqual(t.parts.map((p) => p.kind).sort(), ["date", "priority", "time"]);
});

test("hoy 18:30 pagar la luz", () => {
  const t = parseQuickTask("hoy 18:30 pagar la luz", NOW);
  assert.deepEqual([t.title, t.dueDate, t.dueTime], ["Pagar la luz", "2026-11-08", "18:30"]);
});

test("dia de la semana y proyecto", () => {
  const t = parseQuickTask("viernes comprar cuerdas #musica", NOW, PROJECTS);
  assert.deepEqual([t.title, t.dueDate, t.projectId, t.dueTime], ["Comprar cuerdas", "2026-11-13", "p1", null]);
  // El mismo dia de hoy es la semana siguiente.
  assert.equal(parseQuickTask("domingo descansar", NOW).dueDate, "2026-11-15");
});

test("fechas con mes, barra y dia suelto", () => {
  assert.equal(parseQuickTask("el 15 de noviembre renovar pasaporte !baja", NOW).dueDate, "2026-11-15");
  assert.equal(parseQuickTask("el 15 de noviembre renovar pasaporte !baja", NOW).priority, "LOW");
  assert.equal(parseQuickTask("3 de enero pagar impuesto", NOW).dueDate, "2027-01-03");
  const cita = parseQuickTask("15/12 cita médico 9am", NOW);
  assert.deepEqual([cita.title, cita.dueDate, cita.dueTime], ["Cita médico", "2026-12-15", "09:00"]);
  assert.equal(parseQuickTask("el 5 cobrar arriendo", NOW).dueDate, "2026-12-05");
  assert.equal(parseQuickTask("20 dic. fiesta", NOW).dueDate, "2026-12-20");
});

test("relativas", () => {
  assert.equal(parseQuickTask("pasado mañana gym", NOW).dueDate, "2026-11-10");
  assert.equal(parseQuickTask("en 3 días revisar contrato", NOW).dueDate, "2026-11-11");
  assert.equal(parseQuickTask("en 2 semanas renovar", NOW).dueDate, "2026-11-22");
});

test("horas habladas", () => {
  const t = parseQuickTask("a las 5 de la tarde llamar a mamá", NOW);
  assert.deepEqual([t.title, t.dueTime, t.dueDate], ["Llamar a mamá", "17:00", "2026-11-08"]);
  // Hora que ya paso hoy: queda para mañana.
  assert.equal(parseQuickTask("8am correr", NOW).dueDate, "2026-11-09");
  assert.equal(parseQuickTask("a las 3 mezclar", NOW).dueTime, "15:00");
  assert.equal(parseQuickTask("por la noche estirar", NOW).dueTime, "20:00");
  assert.equal(parseQuickTask("mañana por la mañana estirar", NOW).dueDate, "2026-11-09");
});

test("sin nada que reconocer queda igual", () => {
  const t = parseQuickTask("revisar correos", NOW);
  assert.deepEqual([t.title, t.dueDate, t.dueTime, t.priority, t.reminderEnabled], ["Revisar correos", null, null, "MEDIUM", false]);
  // Un #tag que no existe se avisa pero no asigna proyecto.
  const x = parseQuickTask("idea #nuevo", NOW, PROJECTS);
  assert.deepEqual([x.title, x.projectId, x.projectTag], ["Idea", null, "nuevo"]);
});
