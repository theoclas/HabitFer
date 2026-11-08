/** Hábitos de HabitFer que NutriFer marca solos. */

export const AUTO_SOURCES = ['NUTRI_LOG', 'NUTRI_PROTEIN', 'NUTRI_WATER', 'NUTRI_FAST'] as const;
export type AutoSource = (typeof AUTO_SOURCES)[number];

export const isAutoSource = (v: unknown): v is AutoSource => typeof v === 'string' && (AUTO_SOURCES as readonly string[]).includes(v);

/** Cómo se crea cada hábito si no se conecta uno que ya existe. */
export const AUTO_DEFAULTS: Record<AutoSource, { title: string; description: string; icon: string; color: string; goal: number; unit: string | null }> = {
  NUTRI_LOG: {
    title: 'Anotar mis comidas',
    description: 'Se marca solo con NutriFer cuando anotas tus comidas.',
    icon: '🍽️',
    color: '#5A8A2C',
    goal: 3,
    unit: 'comidas',
  },
  NUTRI_PROTEIN: {
    title: 'Llegar a la proteína',
    description: 'Se marca solo con NutriFer al llegar al 90 % de tu meta de proteína.',
    icon: '🍗',
    color: '#9C2F5E',
    goal: 1,
    unit: null,
  },
  NUTRI_WATER: {
    title: 'Tomar agua',
    description: 'Se marca solo con los vasos de agua que anotas en NutriFer.',
    icon: '💧',
    color: '#2A7AB8',
    goal: 8,
    unit: 'vasos',
  },
  NUTRI_FAST: {
    title: 'Hacer mi ayuno',
    description: 'Se marca solo cuando un ayuno de NutriFer llega a su meta.',
    icon: '⏳',
    color: '#C99500',
    goal: 1,
    unit: null,
  },
};

/** Comidas anotadas que cuentan como «anotar las comidas» en un hábito de sí o no. */
export const LOG_MEALS_FOR_YES = 3;
/** La proteína cuenta desde el 90 % de la meta (igual que en el informe). */
export const PROTEIN_SHARE = 0.9;

export type DayFacts = {
  /** Cuántas comidas del día tienen algo anotado (0 a 5). */
  mealsLogged: number;
  protein: number;
  proteinTarget: number | null;
  waterMl: number;
  waterGoalMl: number;
  glassMl: number;
  /** Horas del ayuno más largo que llegó a su meta ese día (0 si ninguno). */
  fastHours: number;
};

/**
 * El valor del día para el hábito: en uno medible (meta > 1), la cantidad (comidas, gramos, vasos u horas);
 * en uno de sí o no, 1 o 0.
 */
export function autoValue(source: AutoSource, habitGoal: number, f: DayFacts): number {
  const measurable = habitGoal > 1;
  switch (source) {
    case 'NUTRI_LOG':
      return measurable ? f.mealsLogged : f.mealsLogged >= LOG_MEALS_FOR_YES ? 1 : 0;
    case 'NUTRI_PROTEIN':
      if (measurable) return Math.round(f.protein);
      return f.proteinTarget != null && f.proteinTarget > 0 && f.protein >= f.proteinTarget * PROTEIN_SHARE ? 1 : 0;
    case 'NUTRI_WATER':
      return measurable ? Math.floor(f.waterMl / Math.max(1, f.glassMl)) : f.waterMl >= f.waterGoalMl ? 1 : 0;
    case 'NUTRI_FAST':
      return measurable ? Math.floor(f.fastHours) : f.fastHours > 0 ? 1 : 0;
  }
}
