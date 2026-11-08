/**
 * Cadenas colombianas. Ninguna de las de la propuesta (El Corral, Frisby, Crepes & Waffles, Juan Valdez) publica las
 * calorías de sus platos; McDonald's y KFC sí, pero sus términos no dejan copiarlas (y este repositorio es público).
 * Por eso aquí solo va dónde mirar: cada plato se crea una vez y queda guardado con la cadena como marca.
 * Revisado el 8 de noviembre de 2026.
 */
export type Chain = {
  name: string;
  /** Si publica calorías: sí, solo una parte, o no. */
  info: 'si' | 'parcial' | 'no';
  /** Su página oficial con los datos (si los publica). */
  url?: string;
  note: string;
};

export const CHAINS: Chain[] = [
  {
    name: 'El Corral',
    info: 'no',
    note: 'No publica calorías. El menú dice los gramos de carne: sirve para armar el plato por ingredientes en Cocina › Recetas.',
  },
  { name: 'Frisby', info: 'parcial', url: 'https://frisby.com.co', note: 'Solo publica las salsas en sobre (al pie de su página). El pollo y los platos, créalos una vez.' },
  { name: 'Crepes & Waffles', info: 'no', note: 'No publica calorías.' },
  {
    name: 'Juan Valdez',
    info: 'parcial',
    url: 'https://juanvaldez.com/sabores_tablanutricional/',
    note: 'Solo publica el café soluble. Las bebidas y la pastelería de la tienda, créalas una vez.',
  },
  {
    name: "McDonald's",
    info: 'si',
    url: 'https://www.mcdonalds.com.co/menu',
    note: 'Publica las calorías y los macros de cada producto (en su ficha, «Información nutricional»). Algunas fichas traen ceros que no son: revísalos.',
  },
  {
    name: 'KFC',
    info: 'si',
    url: 'https://www.kfc.co/informacion-nutricional',
    note: 'Publica calorías y macros por 100 g de cada presa y acompañamiento (no el peso de la porción): créalo «por 100 g».',
  },
  { name: 'Kokoriko', info: 'no', note: 'No publica calorías.' },
  { name: 'Presto', info: 'no', note: 'No publica calorías; el menú dice los gramos de carne.' },
  { name: 'Sandwich Qbano', info: 'no', note: 'No publica calorías.' },
  { name: 'Tierra Querida', info: 'no', note: 'No publica calorías; el menú dice los gramos de carne.' },
  { name: 'Archie’s', info: 'no', note: 'No publica calorías.' },
  { name: 'Home Burgers', info: 'no', note: 'No publica calorías.' },
  { name: 'PPC', info: 'no', note: 'No publica calorías.' },
  { name: 'Buffalo Wings', info: 'no', note: 'No publica calorías.' },
  { name: 'Oma', info: 'no', note: 'No publica calorías.' },
  { name: 'Tostao’', info: 'no', note: 'No publica calorías.' },
  { name: 'Subway', info: 'no', note: 'No publica las calorías de Colombia (las de otros países no sirven: cambian los productos).' },
  { name: 'Burger King', info: 'no', note: 'No publica calorías.' },
  { name: 'Starbucks', info: 'no', note: 'No publica calorías.' },
  { name: 'Domino’s', info: 'no', note: 'No publica calorías.' },
];
