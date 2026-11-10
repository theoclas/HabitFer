import assert from "node:assert/strict";
import { test } from "node:test";
import { addMonthsKey, dueLabel, formatCop, formatCopSigned, formatThousands, parseMoneyInput, previewInstallments } from "./money.ts";

test("formatCop: pesos sin centavos y con punto de miles", () => {
  assert.equal(formatCop(1500000), "$ 1.500.000");
  assert.equal(formatCop(333333.33), "$ 333.333");
  assert.equal(formatCopSigned(-300000), "−$ 300.000");
  assert.equal(formatCopSigned(850000), "+$ 850.000");
});

test("formatThousands: lo que se ve en el campo", () => {
  assert.equal(formatThousands(1500900), "1.500.900");
  assert.equal(formatThousands("1500900"), "1.500.900");
  assert.equal(formatThousands(""), "");
  assert.equal(formatThousands(undefined), "");
  assert.equal(formatThousands("007"), "7");
});

test("parseMoneyInput: editar 1.500.000 a 1.500.900 guarda 1.500.900 (la falla de antes)", () => {
  assert.equal(parseMoneyInput("1.500.900"), 1500900);
  // A mitad de edición (borrando un dígito) tampoco se vuelve decimal.
  assert.equal(parseMoneyInput("1.500.90"), 150090);
  assert.equal(parseMoneyInput("1.500.9000"), 15009000);
});

test("parseMoneyInput: formatos que alguien puede pegar", () => {
  assert.equal(parseMoneyInput("1500000"), 1500000);
  assert.equal(parseMoneyInput("$ 1.500.000"), 1500000);
  assert.equal(parseMoneyInput("1.500.000,50"), 1500000);
  assert.equal(parseMoneyInput("1,500,000.00"), 1500000);
  assert.equal(parseMoneyInput("18,5"), 18);
  assert.equal(parseMoneyInput(""), null);
  assert.equal(parseMoneyInput("abc"), null);
  assert.equal(parseMoneyInput(1234.6), 1235);
});

test("addMonthsKey: del 31 al último día del mes, sin saltarse meses", () => {
  assert.equal(addMonthsKey("2026-10-31", 1), "2026-11-30");
  assert.equal(addMonthsKey("2027-01-31", 1), "2027-02-28");
  assert.equal(addMonthsKey("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonthsKey("2026-12-15", 2), "2027-02-15");
});

test("previewInstallments: igual que la API", () => {
  assert.deepEqual(previewInstallments(1000000, 333333, "2026-12-05"), { count: 4, last: 1, lastKey: "2027-03-05" });
  assert.deepEqual(previewInstallments(1200000, 300000, "2026-10-31"), { count: 4, last: 300000, lastKey: "2027-01-31" });
  assert.equal(previewInstallments(100, 200, "2026-01-01"), null);
});

test("dueLabel", () => {
  assert.equal(dueLabel("2026-11-09", "2026-11-09"), "vence hoy");
  assert.equal(dueLabel("2026-11-10", "2026-11-09"), "vence mañana");
  assert.equal(dueLabel("2026-11-14", "2026-11-09"), "en 5 días");
  assert.equal(dueLabel("2026-10-31", "2026-11-09"), "vencida hace 9 días");
});
