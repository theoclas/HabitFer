import { parseFoodText, singular, splitCon, stripPrepWords } from './text.parse';

const pick = (text: string) => parseFoodText(text).map(({ name, search, quantity, unit, grams, size, prep, meal }) => ({ name, search, quantity, unit, grams, size, prep, meal }));

describe('escribe o dicta (sin IA)', () => {
  it('desayuné dos arepas con queso y un tinto', () => {
    expect(pick('Desayuné dos arepas con queso y un tinto')).toEqual([
      { name: 'arepas con queso', search: 'arepa queso', quantity: 2, unit: null, grams: null, size: null, prep: null, meal: 'DESAYUNO' },
      { name: 'tinto', search: 'tinto', quantity: 1, unit: null, grams: null, size: null, prep: null, meal: 'DESAYUNO' },
    ]);
  });

  it('gramos, libras y medidas caseras', () => {
    const items = pick('150 g de arroz, media libra de carne molida, un pocillo de chocolate y 1,5 tazas de leche');
    expect(items.map((i) => [i.name, i.quantity, i.unit, i.grams])).toEqual([
      ['arroz', 1, 'g', 150],
      ['carne molida', 1, 'g', 250],
      ['chocolate', 1, 'pocillo', null],
      ['leche', 1.5, 'taza', null],
    ]);
  });

  it('la comida que se nombra vale para lo que sigue', () => {
    const items = pick('almorcé bandeja paisa y limonada, en la comida un pan');
    expect(items.map((i) => [i.name, i.meal])).toEqual([
      ['bandeja paisa', 'ALMUERZO'],
      ['limonada', 'ALMUERZO'],
      ['pan', 'COMIDA'],
    ]);
  });

  it('preparación y tamaño', () => {
    const [huevo, pechuga, arepa] = pick('un huevo frito, pechuga a la plancha y una arepa grande');
    expect(huevo).toMatchObject({ prep: 'FRITO', quantity: 1 });
    expect(pechuga).toMatchObject({ prep: 'ASADO', search: 'pechuga plancha' });
    expect(arepa).toMatchObject({ size: 'grande', quantity: 1 });
  });

  it('medio, un par y fracciones', () => {
    expect(pick('medio plato de lentejas')[0]).toMatchObject({ quantity: 0.5, unit: 'plato', name: 'lentejas' });
    expect(pick('un par de huevos')[0]).toMatchObject({ quantity: 2, name: 'huevos' });
    expect(pick('1/2 aguacate')[0]).toMatchObject({ quantity: 0.5, name: 'aguacate' });
  });

  it('verbos y relleno no se vuelven comida', () => {
    expect(pick('hoy me comí una empanada').map((i) => i.name)).toEqual(['empanada']);
    expect(pick('tomé dos vasos de jugo de mora')[0]).toMatchObject({ quantity: 2, unit: 'vaso', name: 'jugo de mora', search: 'jugo mora' });
  });

  it('nada que entender', () => {
    expect(parseFoodText('')).toEqual([]);
    expect(parseFoodText(' , y . ')).toEqual([]);
  });

  it('«X con Y» se puede partir en dos (la primera se queda con la cantidad)', () => {
    const [item] = parseFoodText('almorcé dos huevos fritos con arepa');
    const parts = splitCon(item);
    expect(parts.map((p) => [p.name, p.search, p.quantity, p.prep, p.meal])).toEqual([
      ['huevos fritos', 'huevo frito', 2, 'FRITO', 'ALMUERZO'],
      ['arepa', 'arepa', null, null, 'ALMUERZO'],
    ]);
    expect(splitCon(parseFoodText('un tinto')[0])).toHaveLength(1);
  });

  it('buscar sin la preparación', () => {
    expect(stripPrepWords('pechuga plancha')).toBe('pechuga');
    expect(stripPrepWords('platano maduro frito')).toBe('platano maduro');
    expect(stripPrepWords('arroz')).toBe('arroz');
  });

  it('singular', () => {
    expect(singular('arepas')).toBe('arepa');
    expect(singular('panes')).toBe('pan');
    expect(singular('porciones')).toBe('porcion');
    expect(singular('maiz')).toBe('maiz');
  });
});
