import { normalize, parseQuery, rank, scoreItem, tokenScore, withinEdits, withoutWords, wordsOf, type SearchItem } from './search.utils';

const item = (id: string, name: string, extra: string[] = [], source = 'TCAC', uses = 0): SearchItem => ({
  id,
  name: normalize(name),
  words: wordsOf(name, ...extra),
  source,
  uses,
});

const FOODS: SearchItem[] = [
  item('arepa-blanca', 'Arepa de maíz blanco', ['arepa redonda']),
  item('arepa-choclo', 'Arepa de choclo'),
  item('arepa-queso', 'Arepa de maíz con queso'),
  item('arroz', 'Arroz blanco, cocido'),
  item('arroz-crudo', 'Arroz blanco, crudo'),
  item('cafe', 'Café, infusión', ['tinto', 'cafe negro']),
  item('panela', 'Agua de panela', ['aguapanela', 'aguadepanela']),
  item('bandeja', 'Bandeja paisa', ['bandeja'], 'DISH'),
  item('frijol', 'Fríjol cargamanto, cocido', ['frijoles']),
  item('chicharron', 'Chicharrón de cerdo', []),
];

describe('normalize y parseQuery', () => {
  it('quita tildes, ñ y signos', () => {
    expect(normalize('  Ñame, PIÑA y Café!  ')).toBe('name pina y cafe');
  });

  it('«sin» descarta la palabra que sigue; «con» y las palabras vacías no cuentan', () => {
    expect(parseQuery('Arepa sin queso')).toEqual({ tokens: ['arepa'], excluded: ['queso'], phrase: 'arepa' });
    expect(parseQuery('arepa con queso de la casa')).toEqual({ tokens: ['arepa', 'queso', 'casa'], excluded: [], phrase: 'arepa queso casa' });
  });
});

describe('coincidencias', () => {
  it('no confunde palabras que empiezan distinto («tinto» no es «pintón»)', () => {
    expect(tokenScore('tinto', ['carambolo', 'pinton', 'deshidratado'])).toBe(0);
    expect(tokenScore('aguacate', ['aguapanela'])).toBe(0);
    expect(tokenScore('aguacte', ['aguacate'])).toBe(3);
  });

  it('la prioridad sube lo de todos los días', () => {
    const comun = { ...item('a', 'Arroz blanco, pulido, cocido, sin sal'), priority: 8 };
    const plato = { ...item('b', 'Arroz con pollo', [], 'DISH'), priority: 4 };
    expect(rank([plato, comun], 'arroz').map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('withinEdits: errores de escritura y letras cambiadas', () => {
    expect(withinEdits('frijol', 'frijol', 0)).toBe(true);
    expect(withinEdits('firjol', 'frijol', 1)).toBe(true); // dos letras cambiadas de lugar
    expect(withinEdits('fijrol', 'frijol', 1)).toBe(false); // la r se movió dos puestos: son 2 cambios
    expect(withinEdits('chicharon', 'chicharron', 1)).toBe(true);
    expect(withinEdits('arepa', 'arroz', 1)).toBe(false);
  });

  it('tokenScore: exacta > comienzo > dentro > con errores', () => {
    const words = ['arepa', 'maiz', 'blanco'];
    expect(tokenScore('arepa', words)).toBe(10);
    expect(tokenScore('are', words)).toBe(7);
    expect(tokenScore('aiz', words)).toBe(4);
    expect(tokenScore('aerpa', words)).toBe(3);
    expect(tokenScore('pollo', words)).toBe(0);
  });

  it('todas las palabras deben coincidir', () => {
    const q = parseQuery('arepa choclo');
    expect(scoreItem(FOODS[1], q)).toBeGreaterThan(0);
    expect(scoreItem(FOODS[0], q)).toBe(0);
  });
});

describe('rank', () => {
  const ids = (q: string) => rank(FOODS, q).map((f) => f.id);

  it('los sinónimos encuentran el alimento: tinto, aguapanela', () => {
    expect(ids('tinto')[0]).toBe('cafe');
    expect(ids('aguapanela')[0]).toBe('panela');
  });

  it('sin tildes ni escritura perfecta', () => {
    expect(ids('frijol')[0]).toBe('frijol');
    expect(ids('chicharon')[0]).toBe('chicharron');
    expect(ids('cafe')[0]).toBe('cafe');
  });

  it('lo cocido antes que lo crudo, salvo que se pida crudo', () => {
    expect(ids('arroz')[0]).toBe('arroz');
    expect(ids('arroz crudo')[0]).toBe('arroz-crudo');
  });

  it('«sin queso» saca la arepa con queso', () => {
    expect(ids('arepa')).toContain('arepa-queso');
    expect(ids('arepa sin queso')).not.toContain('arepa-queso');
  });

  it('«café sin azúcar» no descarta el café cuyo nombre ya dice «sin azúcar»', () => {
    const cafe = { ...item('cafe6', 'Café, infusión al 6 %, sin azúcar'), without: withoutWords('Café, infusión al 6 %, sin azúcar') };
    const dulce = item('cafe-dulce', 'Café con azúcar');
    expect(withoutWords('Arroz blanco, cocido, sin sal')).toEqual(['sal']);
    expect(rank([cafe, dulce], 'cafe sin azucar').map((f) => f.id)).toEqual(['cafe6']);
  });

  it('lo que más anotas sube', () => {
    const withUses = FOODS.map((f) => (f.id === 'arepa-choclo' ? { ...f, uses: 20 } : f));
    expect(rank(withUses, 'arepa')[0].id).toBe('arepa-choclo');
  });

  it('búsqueda vacía o solo palabras vacías: nada', () => {
    expect(rank(FOODS, '   ')).toEqual([]);
    expect(rank(FOODS, 'de la')).toEqual([]);
  });

  it('respeta el límite', () => {
    expect(rank(FOODS, 'a', 2).length).toBeLessThanOrEqual(2);
  });
});
