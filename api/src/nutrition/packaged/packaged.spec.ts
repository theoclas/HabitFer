import { barcodeVariants, isBarcode, offToFood, parseQuantity } from './off.map';
import { computeSeals, hasSweetener } from './seals';

describe('sellos de advertencia (Resolución 810)', () => {
  it('galleta: exceso en azúcares y en grasas saturadas', () => {
    // Galleta Festival (Open Food Facts): 465 kcal, 34 g de azúcares y 7 g de grasa saturada por 100 g.
    expect(computeSeals({ kcal: 465, sugar: 34, satFat: 7, sodium: null })).toEqual(['AZUCARES', 'GRASAS_SATURADAS']);
  });

  it('sodio: 300 mg por 100 g o 1 mg por kcal', () => {
    expect(computeSeals({ kcal: 500, sodium: 320 })).toEqual(['SODIO']);
    expect(computeSeals({ kcal: 150, sodium: 160 })).toEqual(['SODIO']);
    expect(computeSeals({ kcal: 150, sodium: 140 })).toEqual([]);
    expect(computeSeals({ kcal: 0, sodium: 10 })).toEqual([]);
  });

  it('gaseosa con azúcar y gaseosa light', () => {
    expect(computeSeals({ kcal: 46, sugar: 10.8, sodium: 4 })).toEqual(['AZUCARES']);
    expect(computeSeals({ kcal: 1, sugar: 0, sodium: 10, sweetener: true })).toEqual(['SODIO', 'EDULCORANTE']);
  });

  it('grasas trans desde el 1 % de las calorías', () => {
    expect(computeSeals({ kcal: 500, transFat: 0.6 })).toEqual(['GRASAS_TRANS']);
    expect(computeSeals({ kcal: 500, transFat: 0.5 })).toEqual([]);
  });

  it('edulcorantes por aditivo o por ingrediente', () => {
    expect(hasSweetener(['en:e330', 'en:e955'], undefined)).toBe(true);
    expect(hasSweetener([], 'Agua, ácido cítrico, sucralosa')).toBe(true);
    expect(hasSweetener(['en:e330'], 'Agua, azúcar')).toBe(false);
  });
});

describe('productos de Open Food Facts', () => {
  const festival = {
    code: '7702025136735',
    product_name: 'Galleta',
    brands: 'Festival',
    serving_quantity: 50,
    quantity: '12 x 50 g',
    nutriments: {
      'energy-kcal_100g': 465,
      energy_100g: 1945,
      proteins_100g: 4.7,
      fat_100g: 15,
      carbohydrates_100g: 79,
      sugars_100g: 34,
      'saturated-fat_100g': 7,
      fiber_100g: 2.3,
    },
  };

  it('la galleta Festival', () => {
    const f = offToFood(festival, festival.code);
    expect(f).toMatchObject({ name: 'Galleta Festival', brand: 'Festival', check: false, estimated: false });
    expect(f?.per100).toMatchObject({ kcal: 465, protein: 4.7, fat: 15, carbs: 79, sugar: 34, satFat: 7, sodium: null });
    expect(f?.portions).toEqual([
      { label: 'Porción del empaque', grams: 50, isDefault: true },
      { label: 'Paquete', grams: 600, isDefault: false },
    ]);
  });

  it('calorías escritas en kJ se corrigen', () => {
    const f = offToFood({ ...festival, nutriments: { ...festival.nutriments, 'energy-kcal_100g': 1945 } }, 'x');
    // 1.945 no es una cantidad posible de kcal: se toma la energía en kJ y se divide entre 4,184.
    expect(Math.round(f?.per100.kcal ?? 0)).toBe(465);
    // Un producto de 225 kcal (5 g de proteína, 40 g de carbohidratos y 5 g de grasa) con 940 «kcal», que son sus kJ.
    const g = offToFood({ product_name: 'Ponqué', nutriments: { 'energy-kcal_100g': 940, proteins_100g: 5, carbohydrates_100g: 40, fat_100g: 5 } }, 'x');
    expect(Math.round(g?.per100.kcal ?? 0)).toBe(225);
    expect(g?.check).toBe(false);
  });

  it('sin calorías pero con macros: se calculan y se avisa', () => {
    const { 'energy-kcal_100g': _a, energy_100g: _b, ...rest } = festival.nutriments;
    const f = offToFood({ ...festival, nutriments: rest }, 'x');
    expect(f).toMatchObject({ estimated: true });
    expect(f?.per100.kcal).toBe(Math.round(4 * 4.7 + 4 * 79 + 9 * 15));
  });

  it('calorías que no cuadran con los macros quedan para revisar', () => {
    const f = offToFood({ ...festival, nutriments: { ...festival.nutriments, 'energy-kcal_100g': 12.5 } }, 'x');
    expect(f?.check).toBe(true);
  });

  it('sodio en gramos (o sal) pasa a miligramos', () => {
    expect(offToFood({ ...festival, nutriments: { ...festival.nutriments, sodium_100g: 0.42 } }, 'x')?.per100.sodium).toBe(420);
    expect(offToFood({ ...festival, nutriments: { ...festival.nutriments, salt_100g: 1 } }, 'x')?.per100.sodium).toBe(400);
  });

  it('sin tabla nutricional no sirve', () => {
    expect(offToFood({ product_name: 'Algo', nutriments: {} }, 'x')).toBeNull();
    expect(offToFood({ product_name: 'Algo', nutriments: { proteins_100g: 3 } }, 'x')).toBeNull();
  });

  it('bebidas: la botella', () => {
    const f = offToFood({ product_name: 'Gaseosa', quantity: '400 ml', nutriments: { 'energy-kcal_100g': 46, carbohydrates_100g: 11.2, proteins_100g: 0, fat_100g: 0 } }, 'x');
    expect(f).toMatchObject({ liquid: true, portions: [{ label: 'Botella o envase', grams: 400, isDefault: true }] });
  });

  it('cantidades y códigos', () => {
    expect(parseQuantity('1,5 L')).toEqual({ amount: 1500, liquid: true });
    expect(parseQuantity('300g')).toEqual({ amount: 300, liquid: false });
    expect(parseQuantity('1 kg')).toEqual({ amount: 1000, liquid: false });
    expect(parseQuantity('unidad')).toBeNull();
    expect(isBarcode('7702025136735')).toBe(true);
    expect(isBarcode('77020-25')).toBe(false);
    expect(barcodeVariants('012345678905')).toEqual(['012345678905', '0012345678905']);
  });
});
