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
];
