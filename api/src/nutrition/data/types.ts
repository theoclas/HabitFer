/**
 * Datos propios de NutriFer (los escribimos nosotros, por eso sí están en git): medidas caseras,
 * sinónimos colombianos y platos por partes. Apuntan a alimentos de la tabla del ICBF por su código
 * (`code`) o, mientras no se conozca, por una búsqueda (`match`) que el cargador resuelve e informa.
 */
export type FoodRef = { code?: string; match?: string };

export type PortionRule = FoodRef & {
  /** Cuántos alimentos toma la búsqueda (por defecto 1). */
  limit?: number;
  /** [nombre de la medida, gramos, ¿por defecto?]. */
  portions: [label: string, grams: number, isDefault?: boolean][];
};

export type AliasRule = FoodRef & { limit?: number; words: string[] };

export type DishPartDef = FoodRef & { label: string; grams: number };

export type DishDef = {
  name: string;
  /** Palabras extra para encontrarlo («corrientazo», «menú del día»). */
  aliases?: string[];
  /** Nombre de la porción completa (por defecto «Plato»). */
  portion?: string;
  category?: string;
  /** Código de la tabla del ICBF del mismo plato entero: queda oculto (se muestra este por partes) y sirve para comparar. */
  replaces?: string;
  /** Prioridad en la búsqueda (por defecto 4). */
  priority?: number;
  parts: DishPartDef[];
};

/** Prioridad fija para algunos alimentos (negativa para lo raro: leche humana, huevo de iguana…). */
export type PriorityRule = { code: string; priority: number };

/** Alimentos básicos que la tabla del ICBF no trae (el agua). */
export type BasicFood = {
  code: string;
  name: string;
  category: string;
  per100: { kcal: number; protein: number; fat: number; carbs: number; fiber: number; sugar: number; sodium: number };
  aliases: string[];
  portions: [label: string, grams: number, isDefault?: boolean][];
};
