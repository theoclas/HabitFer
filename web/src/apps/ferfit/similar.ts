import type { Exercise } from "./types.ts";

/*
 * Lo que se puede hacer con lo que hay en casa, y ejercicios parecidos para cambiar uno (si algo duele o no se
 * tiene el equipo). Funciones puras (se prueban solas con Node).
 */

/** No hacen falta de verdad: sirve el piso o cualquier pared. */
export const OPTIONAL_GEAR = ["colchoneta", "pared"];

/** Se puede hacer con lo que hay (`has` null: no lo ha dicho, todo se puede). */
export function canDo(ex: Pick<Exercise, "equipment">, has: string[] | null): boolean {
  return !has || ex.equipment.every((q) => OPTIONAL_GEAR.includes(q) || has.includes(q));
}

/** El equipo que falta para una lista de ejercicios (sin repetir). */
export function missingGear(exercises: Pick<Exercise, "equipment">[], has: string[] | null): string[] {
  if (!has) return [];
  const out = new Set<string>();
  for (const ex of exercises) for (const q of ex.equipment) if (!OPTIONAL_GEAR.includes(q) && !has.includes(q)) out.add(q);
  return [...out];
}

/**
 * La dosis al cambiar un ejercicio por otro: se queda la de antes si se mide igual (repeticiones o tiempo); si no,
 * la sugerida del ejercicio nuevo.
 */
export function swapDose(item: { reps: number | null; seconds: number | null }, ex: Pick<Exercise, "reps" | "seconds">): { reps: number | null; seconds: number | null } {
  if (ex.seconds) return { reps: null, seconds: item.seconds ?? ex.seconds };
  return { reps: item.seconds == null && item.reps != null ? item.reps : (ex.reps ?? 10), seconds: null };
}

/** Enfoques que se pueden cambiar entre sí: un ejercicio de fuerza no se cambia por un estiramiento. */
const FAMILY: Record<string, string> = { fuerza: "fuerza", core: "fuerza", cardio: "cardio", movilidad: "suave", estiramiento: "suave" };
const familyOf = (focus: string) => FAMILY[focus] ?? focus;

/**
 * Ejercicios parecidos: primero la versión más fácil o más difícil, después los que trabajan los mismos músculos y
 * tienen el mismo tipo de enfoque. A igual parecido, primero el más fácil. Solo los que se pueden hacer con lo que hay.
 */
export function similarTo(ex: Exercise, all: Exercise[], has: string[] | null, limit = 6): Exercise[] {
  const mine = new Set(ex.muscles.filter((m) => m !== "cuerpo"));
  return all
    .filter((o) => o.key !== ex.key && canDo(o, has))
    .map((o) => {
      const shared = o.muscles.filter((m) => mine.has(m)).length;
      const variant = o.key === ex.easier || o.key === ex.harder || o.easier === ex.key || o.harder === ex.key;
      const sameFocus = o.focus === ex.focus;
      const sameFamily = familyOf(o.focus) === familyOf(ex.focus);
      const score =
        (variant ? 10 : 0) + shared * 3 + (sameFocus ? 2 : 0) - Math.abs(o.level - ex.level) + (o.level <= ex.level ? 0.5 : 0) + (o.impact === "bajo" ? 1 : 0);
      return { o, score, keep: variant || (sameFamily && shared > 0 && (sameFocus || shared >= 2)) };
    })
    .filter((s) => s.keep)
    .sort((a, b) => b.score - a.score || a.o.name.localeCompare(b.o.name))
    .slice(0, limit)
    .map((s) => s.o);
}
