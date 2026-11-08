import { amountText, computeEntry, EntryInputError, inputFromSaved, type FoodForEntry } from './entry.utils';

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

  it('una medida que ya dice cuántos no lleva «1» delante', () => {
    expect(amountText({ portionLabel: '2 huevos', quantity: 1, grams: 150 })).toBe('2 huevos · 150 g');
    expect(amountText({ portionLabel: '2 huevos', quantity: 2, grams: 300 })).toBe('2 × 2 huevos · 300 g');
  });
});

describe('preparación y aceite', () => {
  const huevo: FoodForEntry = {
    id: 'huevo',
    name: 'Huevo de gallina, entero, crudo',
    kcal: 143,
    protein: 12.6,
    fat: 9.5,
    carbs: 0.7,
    portions: [{ id: 'p-u', label: 'Unidad', grams: 50, isDefault: true }],
    parts: [],
  };

  it('frito con una cucharadita: suma 45 kcal y 5 g de grasa', () => {
    const solo = computeEntry(huevo, {});
    const frito = computeEntry(huevo, { prep: 'FRITO', oilGrams: 5 });
    expect(frito).toMatchObject({ prep: 'FRITO', oilGrams: 5, grams: 50 });
    expect(frito.totals.kcal).toBe(solo.totals.kcal + 45);
    expect(frito.totals.fat).toBeCloseTo(solo.totals.fat + 5, 5);
  });

  it('cocido sin aceite guarda la preparación y no suma nada', () => {
    const v = computeEntry(huevo, { prep: 'COCIDO', oilGrams: 0 });
    expect(v).toMatchObject({ prep: 'COCIDO', oilGrams: null });
    expect(v.totals.kcal).toBe(computeEntry(huevo, {}).totals.kcal);
  });

  it('un plato por partes no lleva aceite aparte (ya trae el suyo)', () => {
    const v = computeEntry(bandeja, { prep: 'FRITO', oilGrams: 10 });
    expect(v).toMatchObject({ prep: null, oilGrams: null });
  });

  it('el aceite tiene tope', () => {
    expect(computeEntry(huevo, { prep: 'FRITO', oilGrams: 900 }).oilGrams).toBe(300);
  });

  it('el texto dice cómo se preparó y cuánto aceite lleva', () => {
    expect(amountText({ portionLabel: 'Unidad', quantity: 1, grams: 50, prep: 'FRITO', oilGrams: 5 })).toBe('1 unidad · 50 g · frito, +5 g de aceite');
    expect(amountText({ portionLabel: null, quantity: 1, grams: 150, prep: 'ASADO', oilGrams: 2.5 })).toBe('150 g · asado, +2,5 g de aceite');
    expect(amountText({ portionLabel: null, quantity: 1, grams: 150, prep: 'COCIDO', oilGrams: null })).toBe('150 g · cocido');
  });
});

describe('inputFromSaved: repetir igual', () => {
  it('misma medida, cantidad y preparación', () => {
    const saved = computeEntry(arepa, { portionId: 'p-med', quantity: 2, prep: 'ASADO', oilGrams: 5 });
    const again = computeEntry(arepa, inputFromSaved(saved));
    expect(again).toEqual(saved);
  });

  it('en gramos', () => {
    const saved = computeEntry(arepa, { grams: 123 });
    expect(computeEntry(arepa, inputFromSaved(saved)).grams).toBe(123);
  });

  it('un plato sin el chicharrón sigue sin el chicharrón', () => {
    const saved = computeEntry(bandeja, { parts: [{ partId: 'chicharron', included: false }] });
    const again = computeEntry(bandeja, inputFromSaved(saved));
    expect(again.totals.kcal).toBe(saved.totals.kcal);
    expect(again.parts?.find((p) => p.partId === 'chicharron')?.included).toBe(false);
  });
});
