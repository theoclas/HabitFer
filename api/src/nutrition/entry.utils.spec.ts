import { amountText, computeEntry, EntryInputError, type FoodForEntry } from './entry.utils';

const arepa: FoodForEntry = {
  id: 'arepa',
  name: 'Arepa de maíz blanco',
  kcal: 157,
  protein: 3.4,
  fat: 1.1,
  carbs: 33,
  fiber: 2,
  portions: [
    { id: 'p-peq', label: 'Arepa pequeña', grams: 56, isDefault: true },
    { id: 'p-med', label: 'Arepa mediana', grams: 80, isDefault: false },
  ],
  parts: [],
};

const bandeja: FoodForEntry = {
  id: 'bandeja',
  name: 'Bandeja paisa',
  kcal: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  portions: [{ id: 'p-plato', label: 'Plato', grams: 230, isDefault: true }],
  parts: [
    { id: 'arroz', label: 'Arroz', grams: 150, foodId: 'f-arroz', food: { kcal: 130, protein: 2.7, fat: 0.3, carbs: 28 } },
    { id: 'chicharron', label: 'Chicharrón', grams: 80, foodId: 'f-chich', food: { kcal: 573, protein: 20, fat: 54, carbs: 0 } },
  ],
};

describe('computeEntry', () => {
  it('sin nada: la medida por defecto', () => {
    const v = computeEntry(arepa, {});
    expect(v).toMatchObject({ portionLabel: 'Arepa pequeña', portionGrams: 56, quantity: 1, grams: 56, parts: null });
    expect(v.totals.kcal).toBe(88); // 157 × 0,56 = 87,9
  });

  it('medida y cantidad', () => {
    const v = computeEntry(arepa, { portionId: 'p-med', quantity: 2 });
    expect(v).toMatchObject({ portionLabel: 'Arepa mediana', quantity: 2, grams: 160 });
    expect(v.totals.kcal).toBe(251);
  });

  it('medida por su nombre, sin importar tildes ni mayúsculas', () => {
    expect(computeEntry(arepa, { portionLabel: 'arepa MEDIANA' }).grams).toBe(80);
  });

  it('gramos exactos', () => {
    const v = computeEntry(arepa, { grams: 120 });
    expect(v).toMatchObject({ portionLabel: null, portionGrams: null, quantity: 1, grams: 120 });
    expect(v.totals.kcal).toBe(188);
  });

  it('repetir con una medida que ya no existe: conserva su nombre y sus gramos', () => {
    const v = computeEntry(arepa, { portionLabel: 'Arepa redonda', grams: 140, quantity: 2 });
    expect(v).toMatchObject({ portionLabel: 'Arepa redonda', portionGrams: 70, quantity: 2, grams: 140 });
  });

  it('una medida de otro alimento es un error', () => {
    expect(() => computeEntry(arepa, { portionId: 'otra' })).toThrow(EntryInputError);
  });

  it('sin medidas usa 100 g por cantidad', () => {
    const v = computeEntry({ ...arepa, portions: [] }, { quantity: 1.5 });
    expect(v.grams).toBe(150);
  });

  it('plato por partes: completo, sin chicharrón y medio plato', () => {
    const full = computeEntry(bandeja, {});
    expect(full).toMatchObject({ portionLabel: 'Plato', portionGrams: 230, grams: 230 });
    expect(full.totals.kcal).toBe(653);
    expect(full.parts).toHaveLength(2);

    const sin = computeEntry(bandeja, { parts: [{ partId: 'chicharron', included: false }] });
    expect(sin.grams).toBe(150);
    expect(sin.totals.kcal).toBe(195);
    expect(sin.parts?.find((p) => p.partId === 'chicharron')?.included).toBe(false);

    const medio = computeEntry(bandeja, { quantity: 0.5 });
    expect(medio.totals.kcal).toBe(327);
  });

  it('plato con una parte más grande', () => {
    const v = computeEntry(bandeja, { parts: [{ partId: 'arroz', included: true, grams: 300 }] });
    expect(v.grams).toBe(380);
  });

  it('no se puede quitar todo el plato', () => {
    expect(() =>
      computeEntry(bandeja, {
        parts: [
          { partId: 'arroz', included: false },
          { partId: 'chicharron', included: false },
        ],
      }),
    ).toThrow('Deja al menos una parte del plato.');
  });
});

describe('amountText', () => {
  it('formatos', () => {
    expect(amountText({ portionLabel: 'Arepa pequeña', quantity: 1, grams: 56 })).toBe('1 arepa pequeña · 56 g');
    expect(amountText({ portionLabel: 'Pocillo', quantity: 2, grams: 480 })).toBe('2 × pocillo · 480 g');
    expect(amountText({ portionLabel: 'Plato', quantity: 0.5, grams: 115 })).toBe('½ × plato · 115 g');
    expect(amountText({ portionLabel: null, quantity: 1, grams: 150 })).toBe('150 g');
    expect(amountText({ portionLabel: '100 g', quantity: 1, grams: 100 })).toBe('100 g');
  });
});
