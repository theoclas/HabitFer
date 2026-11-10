import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoryLabel,
  categoryTree,
  dayHeading,
  decodeScope,
  encodeScope,
  firstReconciled,
  groupByDay,
  keypadPress,
  pickerCategories,
} from "./movements.ts";
import type { FinanceCategory, MovementItem } from "./types.ts";

const item = (id: string, date: string, effect: number): MovementItem => ({
  id,
  kind: "tx",
  type: effect >= 0 ? "INCOME" : "EXPENSE",
  date,
  amount: Math.abs(effect),
  effect,
  title: id,
  accountId: "a",
  accountName: "A",
  accountColor: null,
  toAccountId: null,
  toAccountName: null,
  categoryId: null,
  categoryName: null,
  categoryIcon: null,
  merchant: null,
  note: null,
  source: "MANUAL",
  needsReview: false,
  creditId: null,
  creditName: null,
  createdAt: null,
});

const cat = (id: string, extra: Partial<FinanceCategory> = {}): FinanceCategory => ({
  id,
  kind: "EXPENSE",
  parentId: null,
  name: id,
  icon: null,
  color: null,
  systemKey: null,
  sortOrder: 0,
  archivedAt: null,
  uses: 0,
  ...extra,
});

describe("groupByDay", () => {
  it("junta por día y suma lo que dejó cada uno", () => {
    const groups = groupByDay([item("a", "2026-11-10", -18000), item("b", "2026-11-10", 4000), item("c", "2026-11-09", -3200)]);
    assert.deepEqual(
      groups.map((g) => [g.date, g.items.length, g.net]),
      [
        ["2026-11-10", 2, -14000],
        ["2026-11-09", 1, -3200],
      ],
    );
  });
});

describe("firstReconciled", () => {
  const list = [
    { ...item("despues", "2026-11-10", -2500), createdAt: "2026-11-10T18:00:00.000Z" },
    { ...item("ajuste", "2026-11-10", 5000), createdAt: "2026-11-10T15:00:00.000Z" },
    { ...item("antes", "2026-11-09", -3200), createdAt: "2026-11-09T12:00:00.000Z" },
  ];
  it("con el momento: lo anotado después del cuadre queda por encima de la marca", () => {
    assert.equal(firstReconciled(list, { date: "2026-11-10", moment: "2026-11-10T15:00:00.000Z" }), "ajuste");
  });
  it("sin momento (un día que ya pasó): todo ese día estaba cuadrado", () => {
    assert.equal(firstReconciled(list, { date: "2026-11-10", moment: null }), "despues");
    assert.equal(firstReconciled(list, { date: "2026-11-09", moment: null }), "antes");
  });
  it("si nada estaba cuadrado, null", () => {
    assert.equal(firstReconciled(list, { date: "2026-11-01", moment: null }), null);
    assert.equal(firstReconciled(list, null), null);
  });
});

describe("dayHeading", () => {
  it("hoy, ayer y el día con su nombre", () => {
    assert.equal(dayHeading("2026-11-10", "2026-11-10"), "Hoy");
    assert.equal(dayHeading("2026-11-09", "2026-11-10"), "Ayer");
    assert.equal(dayHeading("2026-11-02", "2026-11-10"), "lunes 2 de noviembre");
    assert.equal(dayHeading("2025-12-24", "2026-11-10"), "miércoles 24 de diciembre de 2025");
  });
});

describe("encodeScope y decodeScope", () => {
  it("van y vuelven", () => {
    assert.equal(encodeScope({}), "");
    assert.equal(encodeScope({ book: "BUSINESS" }), "book:BUSINESS");
    assert.equal(encodeScope({ accountId: "x1", book: "PERSONAL" }), "acc:x1");
    assert.deepEqual(decodeScope("acc:x1"), { accountId: "x1", book: null });
    assert.deepEqual(decodeScope("book:PERSONAL"), { accountId: null, book: "PERSONAL" });
    assert.deepEqual(decodeScope("book:RARO"), { accountId: null, book: null });
    assert.deepEqual(decodeScope(undefined), { accountId: null, book: null });
  });
});

describe("categorías", () => {
  const list = [
    cat("comida", { sortOrder: 1 }),
    cat("almuerzo", { parentId: "comida", uses: 9, name: "Almuerzo" }),
    cat("mercado", { sortOrder: 0, uses: 2 }),
    cat("vieja", { archivedAt: "2026-01-01T00:00:00Z", uses: 50 }),
    cat("salario", { kind: "INCOME" }),
  ];

  it("las más usadas primero, sin archivadas ni de otro tipo", () => {
    assert.deepEqual(
      pickerCategories(list, "EXPENSE").map((c) => c.id),
      ["almuerzo", "mercado", "comida"],
    );
  });

  it("árbol de principales con sus subcategorías", () => {
    assert.deepEqual(
      categoryTree(list, "EXPENSE").map((g) => [g.parent.id, g.children.map((c) => c.id)]),
      [
        ["mercado", []],
        ["comida", ["almuerzo"]],
      ],
    );
  });

  it("nombre con la principal", () => {
    assert.equal(categoryLabel(list, "almuerzo"), "comida › Almuerzo");
    assert.equal(categoryLabel(list, "mercado"), "mercado");
    assert.equal(categoryLabel(list, null), "");
  });
});

describe("keypadPress", () => {
  it("escribe, borra y no deja ceros a la izquierda", () => {
    let v = "";
    for (const k of ["0", "1", "8", "000"]) v = keypadPress(v, k);
    assert.equal(v, "18000");
    assert.equal(keypadPress(v, "back"), "1800");
    assert.equal(keypadPress(v, "clear"), "");
    assert.equal(keypadPress(v, "x"), "18000");
    assert.equal(keypadPress("999999999999", "1"), "999999999999");
  });
});
