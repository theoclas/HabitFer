import type { DishDef } from './types';

/**
 * Platos colombianos armados por partes con alimentos de la tabla del ICBF (códigos de la TCAC 2018).
 * Al anotarlos se quita lo que no se comió. Pesos de una porción casera típica (Guías Alimentarias
 * del ICBF y recetas caseras). La carne molida va en peso crudo: la tabla no la trae cocida.
 */
export const DISHES: DishDef[] = [
  {
    name: 'Bandeja paisa',
    category: 'Platos típicos',
    replaces: 'S004',
    parts: [
      { label: 'Fríjoles', code: 'T010', grams: 200 },
      { label: 'Arroz blanco', code: 'A009', grams: 150 },
      { label: 'Carne molida', code: 'F101', grams: 100 },
      { label: 'Chicharrón', code: 'F030', grams: 80 },
      { label: 'Chorizo', code: 'F034', grams: 66 },
      { label: 'Huevo frito', code: 'J006', grams: 55 },
      { label: 'Tajadas de maduro', code: 'B090', grams: 80 },
      { label: 'Arepa', code: 'A006', grams: 60 },
      { label: 'Aguacate', code: 'C002', grams: 60 },
    ],
  },
  {
    name: 'Calentado',
    aliases: ['calentao'],
    category: 'Platos típicos',
    parts: [
      { label: 'Arroz', code: 'A009', grams: 150 },
      { label: 'Fríjoles', code: 'T010', grams: 120 },
      { label: 'Huevo frito', code: 'J006', grams: 55 },
      { label: 'Arepa', code: 'A006', grams: 60 },
    ],
  },
  {
    name: 'Huevos pericos',
    aliases: ['perico', 'huevos revueltos con tomate y cebolla'],
    portion: '2 huevos',
    category: 'Platos típicos',
    priority: 8,
    parts: [
      { label: 'Huevos', code: 'J004', grams: 100 },
      { label: 'Tomate', code: 'B103', grams: 30 },
      { label: 'Cebolla larga', code: 'B029', grams: 15 },
      { label: 'Aceite', code: 'D013', grams: 5 },
    ],
  },
  {
    name: 'Changua',
    category: 'Platos típicos',
    parts: [
      { label: 'Leche', code: 'G012', grams: 200 },
      { label: 'Agua', code: 'agua', grams: 100 },
      { label: 'Huevo', code: 'J004', grams: 50 },
      { label: 'Pan para calar', code: 'A060', grams: 30 },
      { label: 'Cebolla larga', code: 'B028', grams: 10 },
    ],
  },
  {
    name: 'Corrientazo',
    aliases: ['almuerzo ejecutivo', 'menu del dia', 'almuerzo corriente'],
    category: 'Platos típicos',
    parts: [
      { label: 'Sopa del día', code: 'S026', grams: 250 },
      { label: 'Arroz', code: 'A009', grams: 150 },
      { label: 'Fríjoles o lentejas', code: 'T010', grams: 120 },
      { label: 'Carne asada', code: 'F104', grams: 100 },
      { label: 'Tajadas de maduro', code: 'B090', grams: 50 },
      { label: 'Ensalada', code: 'B103', grams: 60 },
    ],
  },
  {
    name: 'Arroz con pollo',
    category: 'Platos típicos',
    parts: [
      { label: 'Arroz', code: 'A009', grams: 200 },
      { label: 'Pollo', code: 'F087', grams: 80 },
      { label: 'Arveja', code: 'B018', grams: 30 },
      { label: 'Zanahoria', code: 'B109', grams: 20 },
      { label: 'Aceite', code: 'D013', grams: 5 },
    ],
  },
  {
    // La tabla no trae buñuelo: masa de queso costeño, almidón de yuca y harina de maíz, frita.
    name: 'Buñuelo',
    aliases: ['bunuelos'],
    portion: 'Unidad mediana',
    category: 'Fritos y panadería',
    parts: [
      { label: 'Queso costeño', code: 'G018', grams: 30 },
      { label: 'Almidón de yuca', code: 'B013', grams: 20 },
      { label: 'Harina de maíz', code: 'A034', grams: 10 },
      { label: 'Huevo', code: 'J004', grams: 10 },
      { label: 'Aceite de la fritura', code: 'D013', grams: 8 },
    ],
  },
  {
    name: 'Arepa de huevo',
    category: 'Fritos y panadería',
    portion: 'Unidad',
    parts: [
      { label: 'Masa de maíz', code: 'A004', grams: 90 },
      { label: 'Huevo', code: 'J004', grams: 50 },
      { label: 'Aceite de la fritura', code: 'D013', grams: 10 },
    ],
  },
  {
    // La del corrientazo: la tabla del ICBF no trae una «ensalada» genérica.
    name: 'Ensalada de la casa',
    aliases: ['ensalada', 'ensalada verde', 'ensalada de tomate', 'ensalada fresca'],
    portion: 'Porción',
    category: 'Acompañamientos',
    parts: [
      { label: 'Tomate', code: 'B103', grams: 50 },
      { label: 'Lechuga', code: 'B059', grams: 30 },
      { label: 'Zanahoria rallada', code: 'B110', grams: 20 },
      { label: 'Cebolla', code: 'B027', grams: 15 },
      { label: 'Limón', code: 'C044', grams: 5 },
    ],
  },
  {
    name: 'Tinto con azúcar',
    aliases: ['tinto', 'cafe con azucar'],
    portion: 'Pocillo tintero',
    category: 'Bebidas',
    parts: [
      { label: 'Café', code: 'H005', grams: 120 },
      { label: 'Azúcar (1 cucharadita)', code: 'K003', grams: 5 },
    ],
  },
  {
    name: 'Café con leche',
    aliases: ['perico', 'pintado', 'cafe con leche'],
    portion: 'Pocillo',
    category: 'Bebidas',
    parts: [
      { label: 'Leche', code: 'G012', grams: 150 },
      { label: 'Café', code: 'H005', grams: 90 },
      { label: 'Azúcar (1 cucharadita)', code: 'K003', grams: 5 },
    ],
  },
  {
    name: 'Chocolate en leche',
    aliases: ['chocolate caliente', 'chocolate santafereno'],
    portion: 'Pocillo',
    category: 'Bebidas',
    parts: [
      { label: 'Leche', code: 'G012', grams: 200 },
      { label: 'Chocolate de mesa', code: 'K010', grams: 20 },
    ],
  },
  {
    name: 'Aguapanela',
    aliases: ['agua de panela', 'aguadepanela', 'guandolo'],
    portion: 'Vaso',
    category: 'Bebidas',
    parts: [
      { label: 'Agua', code: 'agua', grams: 220 },
      { label: 'Panela', code: 'K033', grams: 30 },
    ],
  },
  {
    name: 'Limonada',
    aliases: ['limonada natural', 'agua de limon', 'limonada con azucar'],
    portion: 'Vaso',
    category: 'Bebidas',
    parts: [
      { label: 'Agua', code: 'agua', grams: 210 },
      { label: 'Jugo de limón', code: 'C044', grams: 30 },
      { label: 'Azúcar (3 cucharaditas)', code: 'K003', grams: 15 },
    ],
  },
  ...(
    [
      ['C045', 'lulo'],
      ['C061', 'mora'],
      ['C056', 'maracuyá'],
      ['C030', 'guanábana'],
      ['C051', 'mango'],
      ['C031', 'guayaba'],
      ['C082', 'tomate de árbol'],
      ['C025', 'fresa'],
    ] as const
  ).flatMap(([code, fruit]): DishDef[] => [
    {
      name: `Jugo de ${fruit} en agua`,
      portion: 'Vaso',
      category: 'Jugos',
      parts: [
        { label: `Pulpa de ${fruit}`, code, grams: 100 },
        { label: 'Agua', code: 'agua', grams: 140 },
        { label: 'Azúcar (2 cucharaditas)', code: 'K003', grams: 10 },
      ],
    },
    {
      name: `Jugo de ${fruit} en leche`,
      portion: 'Vaso',
      category: 'Jugos',
      parts: [
        { label: `Pulpa de ${fruit}`, code, grams: 100 },
        { label: 'Leche', code: 'G012', grams: 150 },
        { label: 'Azúcar (2 cucharaditas)', code: 'K003', grams: 10 },
      ],
    },
  ]),
];
