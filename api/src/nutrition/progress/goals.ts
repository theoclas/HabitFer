/** Metas de los nutrientes que no salen de la fórmula de calorías. */

export type NutrientGoals = {
  /** Mínimo de fibra (g). */
  fiber: number;
  /** Límite de azúcares (g). */
  sugar: number;
  /** Límite de sodio (mg). */
  sodium: number;
};

/**
 * Fibra: 14 g por cada 1.000 kcal (Institute of Medicine), al menos 25 g.
 * Azúcares: hasta el 10 % de las calorías (OMS; la base trae azúcares totales cuando los hay).
 * Sodio: hasta 2.000 mg al día (OMS; es el mismo criterio de los sellos).
 */
export function nutrientGoals(kcal: number): NutrientGoals {
  return {
    fiber: Math.max(25, Math.round((kcal / 1000) * 14)),
    sugar: Math.round((kcal * 0.1) / 4),
    sodium: 2000,
  };
}
