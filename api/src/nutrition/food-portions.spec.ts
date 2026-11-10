import { ownPortions } from './food-portions';

describe('medidas de un alimento propio', () => {
  it('por 100 g y sin paquete: solo «100 g»', () => {
    expect(ownPortions({})).toEqual([{ label: '100 g', grams: 100, isDefault: true }]);
  });

  it('por 100 g con el peso del paquete: el paquete queda por defecto (la Oreo de 36 g no se anota como 100 g)', () => {
    expect(ownPortions({ packageGrams: 36 })).toEqual([
      { label: 'Paquete', grams: 36, isDefault: true },
      { label: '100 g', grams: 100, isDefault: false },
    ]);
  });

  it('con una porción de peso conocido: la porción manda y el paquete es otra opción', () => {
    expect(ownPortions({ portionLabel: '3 galletas', portionGrams: 30, packageGrams: 432 })).toEqual([
      { label: '3 galletas', grams: 30, isDefault: true },
      { label: 'Paquete', grams: 432, isDefault: false },
    ]);
  });

  it('el paquete se ignora si la porción no tiene peso o si pesa lo mismo', () => {
    expect(ownPortions({ portionLabel: 'Unidad', packageGrams: 200 })).toEqual([{ label: 'Unidad', grams: 100, isDefault: true }]);
    expect(ownPortions({ portionLabel: 'Paquete', portionGrams: 36, packageGrams: 36.4 })).toEqual([{ label: 'Paquete', grams: 36, isDefault: true }]);
    expect(ownPortions({ packageGrams: 100 })).toEqual([{ label: '100 g', grams: 100, isDefault: true }]);
  });
});
