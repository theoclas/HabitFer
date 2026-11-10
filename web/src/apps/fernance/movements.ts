/** Funciones puras de la lista de movimientos, las categorías y el teclado de plata. */
import type { FinanceAccountType, FinanceCategory, CategoryKind, MovementItem } from "./types";

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export type DayGroup = { date: string; items: MovementItem[]; net: number };

/** Junta los movimientos por día (ya vienen del más reciente al más viejo), con lo que dejó cada día. */
export function groupByDay(items: MovementItem[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const m of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === m.date) {
      last.items.push(m);
      last.net = Math.round((last.net + m.effect) * 100) / 100;
    } else groups.push({ date: m.date, items: [m], net: m.effect });
  }
  return groups;
}

/**
 * El primer movimiento (en el orden de la lista) que ya estaba cuadrado con el banco: la marca «revisado hasta aquí»
 * va justo antes de él. Del día del cuadre, lo anotado después del momento del cuadre queda por encima.
 * null = ninguno estaba cuadrado (la marca va al final).
 */
export function firstReconciled(
  items: MovementItem[],
  reconciled: { date: string; moment: string | null } | null,
): string | null {
  if (!reconciled) return null;
  const covered = (m: MovementItem) =>
    m.date < reconciled.date ||
    (m.date === reconciled.date && (!reconciled.moment || !m.createdAt || m.createdAt <= reconciled.moment));
  return items.find(covered)?.id ?? null;
}

/** «Hoy», «Ayer», «lunes 9 de noviembre» (con el año si no es el de hoy). */
export function dayHeading(dateKey: string, todayKey: string): string {
  const diff = Math.round((Date.parse(todayKey + "T00:00:00Z") - Date.parse(dateKey + "T00:00:00Z")) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const text = `${weekday} ${d} de ${MONTH_NAMES[m - 1]}`;
  return y === Number(todayKey.slice(0, 4)) ? text : `${text} de ${y}`;
}

/** Valor del selector de lo que se mira: «» todo, «book:PERSONAL» un libro, «acc:<id>» una cuenta. */
export function encodeScope(scope: { accountId?: string | null; book?: FinanceAccountType | null }): string {
  if (scope.accountId) return `acc:${scope.accountId}`;
  if (scope.book) return `book:${scope.book}`;
  return "";
}

export function decodeScope(value: string | null | undefined): { accountId: string | null; book: FinanceAccountType | null } {
  if (value?.startsWith("acc:")) return { accountId: value.slice(4), book: null };
  if (value?.startsWith("book:")) {
    const book = value.slice(5);
    if (book === "PERSONAL" || book === "BUSINESS" || book === "OTHER") return { accountId: null, book };
  }
  return { accountId: null, book: null };
}

/** Las categorías para elegir: las más usadas primero; las que no se han usado, en su orden. Sin archivadas. */
export function pickerCategories(categories: FinanceCategory[], kind: CategoryKind): FinanceCategory[] {
  return categories
    .filter((c) => c.kind === kind && !c.archivedAt)
    .sort((a, b) => b.uses - a.uses || (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"));
}

/** Principales con sus subcategorías, en el orden de FerFinance. */
export function categoryTree(categories: FinanceCategory[], kind: CategoryKind, includeArchived = false) {
  const list = categories.filter((c) => c.kind === kind && (includeArchived || !c.archivedAt));
  const order = (a: FinanceCategory, b: FinanceCategory) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es");
  return list
    .filter((c) => !c.parentId)
    .sort(order)
    .map((parent) => ({ parent, children: list.filter((c) => c.parentId === parent.id).sort(order) }));
}

/** «Comida afuera › Almuerzo». */
export function categoryLabel(categories: FinanceCategory[], id: string | null | undefined): string {
  if (!id) return "";
  const c = categories.find((x) => x.id === id);
  if (!c) return "";
  const parent = c.parentId ? categories.find((x) => x.id === c.parentId) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}

const MAX_DIGITS = 12;

/** Una tecla del teclado de plata sobre lo que ya se escribió (solo dígitos, sin ceros a la izquierda). */
export function keypadPress(current: string, key: string): string {
  if (key === "back") return current.slice(0, -1);
  if (key === "clear") return "";
  if (!/^\d+$/.test(key)) return current;
  const next = (current + key).replace(/^0+/, "");
  return next.length > MAX_DIGITS ? current : next;
}
