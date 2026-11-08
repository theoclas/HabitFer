import { canPrep, matchPortion, proposeAmount, suggestedOil } from './text.amount';

const arepa = {
  portions: [
    { id: 'peq', label: 'Arepa pequeña', grams: 56, isDefault: true },
    { id: 'med', label: 'Arepa mediana', grams: 80, isDefault: false },
    { id: 'gra', label: 'Arepa grande', grams: 110, isDefault: false },
  ],
};
const chocolate = {
  portions: [
    { id: 'poc', label: 'Pocillo', grams: 240, isDefault: true },
    { id: 'tin', label: 'Pocillo tintero', grams: 120, isDefault: false },
    { id: 'vas', label: 'Vaso mediano', grams: 200, isDefault: false },
  ],
};
const none = { quantity: null, unit: null, size: null, grams: null };

describe('cuánto proponer', () => {
  it('la medida nombrada y el tamaño', () => {
    expect(matchPortion(chocolate.portions, 'vasos', null)?.id).toBe('vas');
    expect(matchPortion(chocolate.portions, 'pocillo', null)?.id).toBe('poc');
    expect(matchPortion(arepa.portions, null, 'grande')?.id).toBe('gra');
    expect(matchPortion(arepa.portions, 'taza', null)).toBeUndefined();
  });

  it('los gramos dichos mandan', () => {
    expect(proposeAmount(arepa, { ...none, grams: 130, unit: 'g', quantity: 1 }, null)).toEqual({ grams: 130, quantity: 1, how: 'gramos' });
  });

  it('«dos vasos» es la medida por dos', () => {
    expect(proposeAmount(chocolate, { ...none, quantity: 2, unit: 'vaso' }, null)).toEqual({ portionId: 'vas', quantity: 2, how: 'medida' });
  });

  it('lo de siempre: si la última vez fue una arepa mediana, «dos arepas» son dos medianas', () => {
    const usual = { portionLabel: 'Arepa mediana', quantity: 1, grams: 80 };
    expect(proposeAmount(arepa, { ...none, quantity: 2 }, usual)).toEqual({ portionId: 'med', quantity: 2, how: 'lo-de-siempre' });
    expect(proposeAmount(arepa, none, { portionLabel: 'Arepa mediana', quantity: 2, grams: 160 })).toMatchObject({ portionId: 'med', quantity: 2 });
  });

  it('lo de siempre en gramos: si siempre la corriges a 120 g, propone 120 g', () => {
    expect(proposeAmount(arepa, none, { portionLabel: null, quantity: 1, grams: 120 })).toEqual({ grams: 120, quantity: 1, how: 'lo-de-siempre' });
    expect(proposeAmount(arepa, { ...none, quantity: 2 }, { portionLabel: null, quantity: 1, grams: 120 })).toMatchObject({ grams: 240 });
  });

  it('una medida vieja que ya no existe: sus gramos por unidad', () => {
    expect(proposeAmount(arepa, { ...none, quantity: 3 }, { portionLabel: 'Arepa redonda', quantity: 2, grams: 140 })).toMatchObject({ grams: 210 });
  });

  it('sin nada: la medida por defecto (o 100 g)', () => {
    expect(proposeAmount(arepa, { ...none, quantity: 2 }, null)).toEqual({ portionId: 'peq', quantity: 2, how: 'por-defecto' });
    expect(proposeAmount({ portions: [] }, none, null)).toEqual({ grams: 100, quantity: 1, how: 'por-defecto' });
  });
});

describe('aceite de la preparación', () => {
  it('solo a lo que se cocina y no viene ya frito', () => {
    const pollo = { name: 'Pollo, pechuga sin piel, cruda', category: 'Carnes y derivados', source: 'TCAC', isDish: false };
    expect(canPrep(pollo)).toBe(true);
    expect(canPrep({ ...pollo, name: 'Pollo, pechuga sin piel, frita sin sal' })).toBe(false);
    expect(canPrep({ ...pollo, category: 'Frutas y derivados' })).toBe(false);
    expect(canPrep({ ...pollo, isDish: true })).toBe(false);
  });

  it('cuánto aceite', () => {
    expect(suggestedOil('FRITO', 150)).toBe(15);
    expect(suggestedOil('ASADO', 150)).toBe(5);
    expect(suggestedOil('COCIDO', 150)).toBe(0);
  });
});
