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
];
