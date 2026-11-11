import type { BasicFood } from './types';

/** Lo que la tabla del ICBF no trae pero hace falta para armar bebidas (valores del USDA, dominio público). */
export const BASICS: BasicFood[] = [
  {
    code: 'agua',
    name: 'Agua',
    category: 'Bebidas',
    per100: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 },
    aliases: ['agua potable', 'agua de la llave', 'agua mineral'],
    portions: [['Vaso', 250, true], ['Botella', 600]],
  },
  /* ---------- Agregados el 10 nov 2026 (USDA FoodData Central; el fdcId va al lado) ---------- */
  {
    // 2708616 Pizza, cheese, from restaurant or fast food, medium crust. La hawaiana queda muy parecida.
    code: 'pizza-queso',
    name: 'Pizza de queso o hawaiana',
    category: 'Comidas rápidas',
    per100: { kcal: 266, protein: 11.39, fat: 9.69, carbs: 33.33, fiber: 2.3, sugar: 3.58, sodium: 540 },
    aliases: ['pizza', 'pizza hawaiana', 'pizza de queso', 'pizza margarita', 'pizza de jamon y pina'],
    portions: [['Tajada', 110, true], ['2 tajadas', 220], ['Pizza personal', 300]],
  },
  {
    // 2708640 Pizza with pepperoni, from restaurant or fast food, medium crust.
    code: 'pizza-pepperoni',
    name: 'Pizza de pepperoni',
    category: 'Comidas rápidas',
    per100: { kcal: 282, protein: 11.74, fat: 11.91, carbs: 31.98, fiber: 2.3, sugar: 3.26, sodium: 620 },
    aliases: ['pizza peperoni', 'pizza de salami', 'pizza de carnes'],
    portions: [['Tajada', 110, true], ['2 tajadas', 220], ['Pizza personal', 300]],
  },
  {
    // 171475 Chicken, broilers or fryers, breast, meat and skin, cooked, fried, batter.
    code: 'pollo-apanado',
    name: 'Pollo apanado frito',
    category: 'Comidas rápidas',
    per100: { kcal: 260, protein: 24.8, fat: 13.2, carbs: 8.99, fiber: 0.3, sugar: 0, sodium: 275 },
    aliases: ['pollo apanado', 'pollo frito apanado', 'pollo broaster', 'presa apanada'],
    portions: [['Presa', 120, true], ['2 presas', 240]],
  },
  {
    // 2706093 Chicken nuggets, from fast food.
    code: 'nuggets',
    name: 'Nuggets de pollo',
    category: 'Comidas rápidas',
    per100: { kcal: 307, protein: 15.92, fat: 20.36, carbs: 14.93, fiber: 0.9, sugar: 0.08, sodium: 594 },
    aliases: ['nuggets', 'nugets', 'deditos de pollo'],
    portions: [['6 unidades', 96, true], ['Unidad', 16], ['10 unidades', 160]],
  },
  {
    // 171646 Cereals ready-to-eat, granola, homemade.
    code: 'granola',
    name: 'Granola',
    category: 'Cereales',
    per100: { kcal: 489, protein: 13.7, fat: 24.3, carbs: 53.9, fiber: 8.9, sugar: 19.8, sodium: 26 },
    aliases: ['granola', 'muesli'],
    portions: [['3 cucharadas', 30, true], ['Porción', 50]],
  },
  {
    // 170554 Seeds, chia seeds, dried.
    code: 'chia',
    name: 'Semillas de chía',
    category: 'Semillas',
    per100: { kcal: 486, protein: 16.5, fat: 30.7, carbs: 42.1, fiber: 34.4, sugar: 0, sodium: 16 },
    aliases: ['chia', 'semillas de chia'],
    portions: [['Cucharada', 12, true], ['Cucharadita', 4]],
  },
  {
    // 173180 Beverages, Protein powder whey based.
    code: 'proteina-whey',
    name: 'Proteína en polvo (whey)',
    category: 'Suplementos',
    per100: { kcal: 352, protein: 78.1, fat: 1.56, carbs: 6.25, fiber: 3.1, sugar: 0, sodium: 156 },
    aliases: ['proteina', 'whey', 'proteina en polvo', 'batido de proteina', 'scoop de proteina'],
    portions: [['Scoop', 30, true], ['2 scoops', 60]],
  },
  {
    // 169677 Snacks, potato chips, plain, salted. También son las papitas ripio del perro y la mazorca.
    code: 'papas-paquete',
    name: 'Papas fritas de paquete',
    category: 'Mecato',
    per100: { kcal: 532, protein: 6.39, fat: 34, carbs: 53.8, fiber: 3.1, sugar: 0.33, sodium: 527 },
    aliases: ['papitas', 'papas de paquete', 'papas chips', 'chips', 'papitas ripio', 'ripio', 'paquete de papas'],
    portions: [['Paquete personal', 30, true], ['Puñado', 15], ['Paquete mediano', 60]],
  },
  {
    // 175000 Ice cream cones, cake or wafer-type: la misma masa delgada de harina de las obleas.
    code: 'hoja-oblea',
    name: 'Hoja de oblea',
    category: 'Postres y dulces',
    per100: { kcal: 417, protein: 8.1, fat: 6.9, carbs: 79, fiber: 3, sugar: 6, sodium: 256 },
    aliases: ['hojas de oblea', 'oblea sola'],
    portions: [['Hoja', 6, true], ['2 hojas', 12]],
  },
  {
    // 169098 Orange juice, raw.
    code: 'jugo-naranja',
    name: 'Jugo de naranja natural',
    category: 'Jugos',
    per100: { kcal: 45, protein: 0.7, fat: 0.2, carbs: 10.4, fiber: 0.2, sugar: 8.4, sodium: 1 },
    aliases: ['jugo de naranja', 'zumo de naranja', 'naranjada', 'jugo de naranja exprimido'],
    portions: [['Vaso', 250, true], ['Vaso pequeño', 150]],
  },
  {
    // 172758 Doughnuts, yeast-leavened, glazed, enriched.
    code: 'dona',
    name: 'Dona glaseada',
    category: 'Fritos y panadería',
    per100: { kcal: 421, protein: 6.14, fat: 22.7, carbs: 47.9, fiber: 2.1, sugar: 22.8, sodium: 316 },
    aliases: ['dona', 'donas', 'donut', 'donuts', 'rosquilla glaseada'],
    portions: [['Unidad', 60, true]],
  },
  {
    // 2708070 Churros.
    code: 'churro',
    name: 'Churro',
    category: 'Fritos y panadería',
    per100: { kcal: 419, protein: 6.05, fat: 22.21, carbs: 48.87, fiber: 2.6, sugar: 23.38, sodium: 309 },
    aliases: ['churros', 'churro con azucar'],
    portions: [['Unidad', 30, true], ['3 unidades', 90]],
  },
  {
    // 167574 Desserts, flan, caramel custard, prepared-from-recipe.
    code: 'flan',
    name: 'Flan de caramelo',
    category: 'Postres y dulces',
    per100: { kcal: 145, protein: 4.53, fat: 4.03, carbs: 22.8, fiber: 0, sugar: 22.8, sodium: 53 },
    aliases: ['flan', 'flan de leche', 'flan casero'],
    portions: [['Porción', 100, true]],
  },
  {
    // 167542 Snacks, granola bars, hard, plain.
    code: 'barra-cereal',
    name: 'Barra de cereal',
    category: 'Mecato',
    per100: { kcal: 471, protein: 10.1, fat: 19.8, carbs: 64.4, fiber: 5.3, sugar: 28.6, sodium: 294 },
    aliases: ['barrita de cereal', 'barra de granola', 'barrita', 'cereal en barra'],
    portions: [['Unidad', 25, true]],
  },
  {
    // 170247 Snacks, popcorn, oil-popped, white popcorn, salt added (las del cine o la olla). No trae
    // azúcar: va la de 169861 (las mismas, sin sal).
    code: 'crispetas',
    name: 'Crispetas con aceite y sal',
    category: 'Mecato',
    per100: { kcal: 500, protein: 9, fat: 28.1, carbs: 57.2, fiber: 10, sugar: 0.5, sodium: 884 },
    aliases: ['crispetas', 'palomitas', 'popetas', 'cotufas', 'maiz pira', 'crispetas de sal', 'crispetas de cine'],
    portions: [['Bolsa pequeña', 30, true], ['Pocillo', 11], ['Bolsa grande de cine', 100]],
  },
  {
    // 167552 Snacks, popcorn, caramel-coated, without peanuts.
    code: 'crispetas-caramelo',
    name: 'Crispetas de caramelo',
    category: 'Mecato',
    per100: { kcal: 431, protein: 3.8, fat: 12.8, carbs: 79.1, fiber: 5.2, sugar: 53.2, sodium: 206 },
    aliases: ['crispetas de dulce', 'palomitas de caramelo', 'popetas de caramelo'],
    portions: [['Bolsa pequeña', 30, true], ['Pocillo', 35]],
  },
  /*
   * Licores: las calorías salen del alcohol (7 kcal por gramo), que no es un macro. Base: el destilado de
   * 80 proof del USDA (174817/174818, 40 % de alcohol, 231 kcal por 100 g); el ron y el aguardiente se
   * calculan por sus grados (35 % y 29 %). Solo el alcohol: si el aguardiente es dulce, es un poco más.
   */
  {
    code: 'licor-40',
    name: 'Whisky, vodka, ginebra o tequila (40 %)',
    category: 'Licores',
    per100: { kcal: 231, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 1 },
    aliases: ['whisky', 'whiskey', 'vodka', 'ginebra', 'gin', 'tequila', 'trago'],
    portions: [['Trago (1 onza)', 30, true], ['Trago doble', 60]],
  },
  {
    code: 'ron',
    name: 'Ron (35 %)',
    category: 'Licores',
    per100: { kcal: 202, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 1 },
    aliases: ['ron', 'ron anejo', 'ron blanco', 'ron medellin', 'ron viejo de caldas'],
    portions: [['Trago (1 onza)', 30, true], ['Media botella', 375], ['Botella', 750]],
  },
  {
    code: 'aguardiente',
    name: 'Aguardiente (29 %)',
    category: 'Licores',
    per100: { kcal: 167, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 1 },
    aliases: ['aguardiente', 'guaro', 'chorro', 'aguardiente antioqueno', 'aguardiente nectar', 'aguardiente sin azucar'],
    portions: [['Trago', 30, true], ['Media', 375], ['Botella', 750]],
  },
  {
    // 173190 Alcoholic beverage, wine, table, red (10,6 g de alcohol por 100 g).
    code: 'vino-tinto',
    name: 'Vino tinto',
    category: 'Licores',
    per100: { kcal: 85, protein: 0.07, fat: 0, carbs: 2.61, fiber: 0, sugar: 0.62, sodium: 4 },
    aliases: ['vino', 'copa de vino', 'vino rojo'],
    portions: [['Copa', 150, true], ['Botella', 750]],
  },
  {
    // 174837 Alcoholic beverage, wine, table, white.
    code: 'vino-blanco',
    name: 'Vino blanco',
    category: 'Licores',
    per100: { kcal: 82, protein: 0.07, fat: 0, carbs: 2.6, fiber: 0, sugar: 0.96, sodium: 5 },
    aliases: ['vino blanco', 'copa de vino blanco'],
    portions: [['Copa', 150, true], ['Botella', 750]],
  },
];
