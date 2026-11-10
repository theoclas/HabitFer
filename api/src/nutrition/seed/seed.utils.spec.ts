import { nameKey, packagedPlan, portionLabel, slug, suspicious, tidyName } from './seed.utils';

describe('cargador: ayudas', () => {
  it('tidyName: mayúsculas a frase; lo demás se respeta', () => {
    expect(tidyName('ARROZ BLANCO, COCIDO')).toBe('Arroz blanco, cocido');
    expect(tidyName('ÑAME  COCIDO')).toBe('Ñame cocido');
    expect(tidyName('Arepa de maíz blanco')).toBe('Arepa de maíz blanco');
    expect(tidyName('arepa de choclo')).toBe('Arepa de choclo');
  });

  it('portionLabel', () => {
    expect(portionLabel('1 unidad pequeña')).toBe('Unidad pequeña');
    expect(portionLabel('1/2 taza')).toBe('½ taza');
    expect(portionLabel('2 cucharadas')).toBe('2 cucharadas');
    expect(portionLabel('  1  pocillo ')).toBe('Pocillo');
    expect(portionLabel('')).toBe('Porción');
  });

  it('slug y nameKey', () => {
    expect(slug('Bandeja paisa')).toBe('bandeja-paisa');
    expect(slug('Ajiaco santafereño')).toBe('ajiaco-santafereno');
    expect(nameKey('Arroz blanco, cocido')).toBe('arroz blanco cocido');
    expect(nameKey('Café, infusión del día')).toBe('cafe infusion dia');
  });

  it('suspicious: kcal que no cuadran con los macros', () => {
    expect(suspicious({ kcal: 130, protein: 2.7, fat: 0.3, carbs: 28 })).toBe(false);
    expect(suspicious({ kcal: 12.5, protein: 8, fat: 10, carbs: 50 })).toBe(true); // pandebono mal anotado
    expect(suspicious({ kcal: 1380, protein: 5, fat: 30, carbs: 60 })).toBe(true); // kJ en el campo de kcal
    expect(suspicious({ kcal: 1, protein: 0.1, fat: 0, carbs: 0 })).toBe(false); // café
    expect(suspicious({ kcal: 0, protein: 0, fat: 0, carbs: 0 })).toBe(false); // agua
  });

  it('packagedPlan: sin repetir, solo códigos válidos y lo que falta (o todo si se refresca)', () => {
    const list = [{ code: '7622300489434' }, { code: '7702011000014' }, { code: '7622300489434' }, { code: 'abc' }, { code: '123' }];
    const saved = new Set(['7702011000014']);
    expect(packagedPlan(list, saved, false)).toEqual({ fetch: ['7622300489434'], skip: ['7702011000014'], invalid: ['abc', '123'] });
    expect(packagedPlan(list, saved, true).fetch).toEqual(['7622300489434', '7702011000014']);
  });
});
