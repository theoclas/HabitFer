/** Ayudas del cargador de alimentos (funciones puras, con pruebas). */

const SMALL_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'sin', 'en', 'a', 'al', 'o']);

/**
 * Nombre para mostrar: la tabla del ICBF escribe muchos nombres en MAYÚSCULAS; se dejan en
 * minúscula con la primera letra en mayúscula. Los nombres ya escritos normal se respetan.
 */
export function tidyName(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  if (letters && letters === letters.toLocaleUpperCase('es')) {
    const lower = s.toLocaleLowerCase('es');
    return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
  }
  return s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
}

const FRACTIONS: Record<string, string> = { '1/2': '½', '1/3': '⅓', '1/4': '¼', '3/4': '¾', '2/3': '⅔' };

/** «1 unidad pequeña» → «Unidad pequeña»; «1/2 taza» → «½ taza»; «2 cucharadas» igual. */
export function portionLabel(measure: string): string {
  let s = measure.replace(/\s+/g, ' ').trim();
  for (const [frac, glyph] of Object.entries(FRACTIONS)) s = s.replace(new RegExp(`(^|\\s)${frac.replace('/', '\\/')}(\\s|$)`), `$1${glyph}$2`);
  s = s.replace(/^1\s+(?!\/)/, '');
  if (!s) return 'Porción';
  return s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
}

/** Clave estable para un plato o preparación: «Bandeja paisa» → «bandeja-paisa». */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Valores por 100 g que no cuadran con sus macros (Atwater con ±35 %): sirven de alerta, no se descartan. */
export function suspicious(p: { kcal: number; protein: number; fat: number; carbs: number }): boolean {
  const est = 4 * p.protein + 4 * p.carbs + 9 * p.fat;
  if (p.kcal < 5 && est < 5) return false;
  if (est === 0) return p.kcal > 20;
  const ratio = p.kcal / est;
  return ratio < 0.65 || ratio > 1.35;
}

/** Palabras con mayúscula inicial tras «de», etc. no cambian: solo se usa para comparar nombres. */
export function nameKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !SMALL_WORDS.has(w))
    .join(' ');
}
