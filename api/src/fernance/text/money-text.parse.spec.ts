import { SYSTEM_CATEGORIES, SYSTEM_CATEGORY_COUNT } from './money-text.data';
import {
  categoryFromText,
  normalizeKeyword,
  parseMoneyText,
  parseNumeric,
  readAmount,
  type ParseCategory,
  type ParseContext,
} from './money-text.parse';

/** Las categorías de FerFinance con su clave como id, para leer las pruebas fácil. */
function systemCategories(skip: string[] = []): ParseCategory[] {
  const out: ParseCategory[] = [];
  for (const p of SYSTEM_CATEGORIES) {
    if (!skip.includes(p.key))
      out.push({
        id: p.key,
        kind: p.kind,
        systemKey: p.key,
        parentId: null,
        name: p.name,
      });
    for (const c of p.children ?? []) {
      if (!skip.includes(c.key))
        out.push({
          id: c.key,
          kind: p.kind,
          systemKey: c.key,
          parentId: p.key,
          name: c.name,
        });
    }
  }
  return out;
}

const CTX: ParseContext = {
  todayKey: '2026-11-10', // martes
  accounts: [
    {
      id: 'acc-banco',
      name: 'Bancolombia ahorros',
      institution: 'Bancolombia',
      kind: 'SAVINGS',
    },
    { id: 'acc-nequi', name: 'Nequi', institution: 'Nequi', kind: 'WALLET' },
    { id: 'acc-cash', name: 'Efectivo', institution: null, kind: 'CASH' },
    {
      id: 'acc-nu',
      name: 'Tarjeta Nu',
      institution: 'Nu',
      kind: 'CREDIT_CARD',
    },
    { id: 'acc-personal', name: 'Personal', institution: null, kind: 'OTHER' },
  ],
  categories: systemCategories(),
  keywords: [
    { keyword: 'chuzo', categoryId: 'comida-rapida', accountId: null },
    { keyword: 'bancol', categoryId: null, accountId: 'acc-banco' },
    { keyword: 'dropi', categoryId: 'ventas', accountId: null },
  ],
};

const parse = (text: string, ctx: ParseContext = CTX) =>
  parseMoneyText(text, ctx);

describe('parseNumeric', () => {
  it('lee los separadores de Colombia', () => {
    expect(parseNumeric('18')).toBe(18);
    expect(parseNumeric('18.000')).toBe(18000);
    expect(parseNumeric('18,000')).toBe(18000);
    expect(parseNumeric('1.234.567')).toBe(1234567);
    expect(parseNumeric('1.234.567,89')).toBe(1234567);
    expect(parseNumeric('1,2')).toBe(1.2);
    expect(parseNumeric('3.5')).toBe(3.5);
    expect(parseNumeric('abc')).toBeNull();
  });
});

describe('readAmount', () => {
  it('entiende lucas, palos, mil y millones', () => {
    expect(readAmount(['18', 'lucas'])?.value).toBe(18000);
    expect(readAmount(['1,2', 'palos'])?.value).toBe(1_200_000);
    expect(readAmount(['un', 'millon', 'doscientos', 'mil'])?.value).toBe(
      1_200_000,
    );
    expect(readAmount(['2', 'palos', '300'])?.value).toBe(2_300_000);
    expect(readAmount(['18', 'mil', '500'])?.value).toBe(18_500);
    expect(readAmount(['palo', 'y', 'medio'])?.value).toBe(1_500_000);
    expect(readAmount(['media', 'luca'])?.value).toBe(500);
    expect(readAmount(['treinta', 'y', 'cinco', 'mil'])?.value).toBe(35_000);
  });

  it('toma los números pequeños sin unidad como miles, salvo si dice pesos', () => {
    expect(readAmount(['18'])).toMatchObject({
      value: 18000,
      assumedThousands: true,
      hasUnit: false,
    });
    expect(readAmount(['500', 'pesos'])).toMatchObject({
      value: 500,
      assumedThousands: false,
    });
    expect(readAmount(['3200'])).toMatchObject({
      value: 3200,
      assumedThousands: false,
    });
  });
});

describe('parseMoneyText', () => {
  it('«almuerzo 18 lucas nequi»', () => {
    expect(parse('almuerzo 18 lucas nequi')).toMatchObject({
      type: 'EXPENSE',
      amount: 18000,
      accountId: 'acc-nequi',
      categoryId: 'comida-almuerzo',
      note: 'Almuerzo',
      date: '2026-11-10',
      assumedThousands: false,
    });
  });

  it('«mercado 1,2 palos tarjeta»: la única tarjeta de crédito', () => {
    expect(parse('mercado 1,2 palos tarjeta')).toMatchObject({
      type: 'EXPENSE',
      amount: 1_200_000,
      accountId: 'acc-nu',
      categoryId: 'mercado',
      note: 'Mercado',
    });
  });

  it('transferencias entre tus cuentas', () => {
    expect(parse('pasé 200 lucas de Bancolombia a Nequi')).toMatchObject({
      type: 'TRANSFER',
      amount: 200_000,
      accountId: 'acc-banco',
      toAccountId: 'acc-nequi',
      categoryId: null,
      note: null,
    });
    expect(parse('recargué nequi 50 lucas')).toMatchObject({
      type: 'TRANSFER',
      amount: 50_000,
      accountId: null,
      toAccountId: 'acc-nequi',
    });
    expect(parse('transferencia a nequi 50 mil')).toMatchObject({
      type: 'TRANSFER',
      toAccountId: 'acc-nequi',
    });
  });

  it('retiros, consignaciones y el pago de la tarjeta no son gastos', () => {
    expect(parse('retiré 300 lucas')).toMatchObject({
      type: 'TRANSFER',
      amount: 300_000,
      accountId: null,
      toAccountId: 'acc-cash',
    });
    expect(parse('consigné 200 mil en bancolombia')).toMatchObject({
      type: 'TRANSFER',
      accountId: 'acc-cash',
      toAccountId: 'acc-banco',
    });
    expect(parse('pagué la tarjeta 500 mil desde bancolombia')).toMatchObject({
      type: 'TRANSFER',
      amount: 500_000,
      accountId: 'acc-banco',
      toAccountId: 'acc-nu',
    });
  });

  it('ingresos', () => {
    expect(parse('me pagaron la quincena 2 palos')).toMatchObject({
      type: 'INCOME',
      amount: 2_000_000,
      categoryId: 'salario',
      note: 'Quincena',
    });
    expect(parse('honorarios 3 palos')).toMatchObject({
      type: 'INCOME',
      categoryId: 'honorarios',
    });
    expect(parse('venta 120 mil efectivo')).toMatchObject({
      type: 'INCOME',
      categoryId: 'ventas',
      accountId: 'acc-cash',
    });
    // Alguien te transfirió: es un ingreso, no un movimiento entre tus cuentas.
    expect(parse('me hicieron una transferencia de 200 mil')).toMatchObject({
      type: 'INCOME',
      amount: 200_000,
    });
  });

  it('una palabra de los dos tipos es gasto, salvo que diga que le pagaron', () => {
    expect(parse('intereses 50 mil')).toMatchObject({
      type: 'EXPENSE',
      categoryId: 'bancos-intereses',
    });
    expect(parse('me pagaron intereses 50 mil')).toMatchObject({
      type: 'INCOME',
      categoryId: 'rendimientos',
    });
  });

  it('montos de muchas formas', () => {
    expect(parse('tinto 2500')).toMatchObject({
      amount: 2500,
      categoryId: 'comida-cafe',
    });
    expect(parse('bus 3.200')).toMatchObject({
      amount: 3200,
      categoryId: 'transporte-publico',
    });
    expect(parse('medio palo arriendo')).toMatchObject({
      amount: 500_000,
      categoryId: 'vivienda-arriendo',
    });
    expect(parse('palo y medio')).toMatchObject({ amount: 1_500_000 });
    expect(parse('luca y media')).toMatchObject({ amount: 1500 });
    expect(parse('2 palos 300')).toMatchObject({ amount: 2_300_000 });
    expect(parse('un millón doscientos mil')).toMatchObject({
      amount: 1_200_000,
    });
    expect(parse('treinta y cinco mil almuerzo')).toMatchObject({
      amount: 35_000,
    });
    expect(parse('500 pesos bolsa')).toMatchObject({
      amount: 500,
      assumedThousands: false,
    });
    expect(parse('$18.000 almuerzo')).toMatchObject({ amount: 18_000 });
    expect(parse('gasolina 18k')).toMatchObject({
      amount: 18_000,
      categoryId: 'transporte-gasolina',
    });
    expect(parse('arriendo 1.800.000')).toMatchObject({ amount: 1_800_000 });
    expect(parse('repuesto 1.5m')).toMatchObject({ amount: 1_500_000 });
  });

  it('«almuerzo 18» son $ 18.000 y lo avisa', () => {
    const r = parse('almuerzo 18');
    expect(r).toMatchObject({ amount: 18_000, assumedThousands: true });
    expect(r.hints.join(' ')).toContain('miles');
  });

  it('con varios números, gana el que tiene unidad y lo demás queda en la nota', () => {
    expect(parse('dos almuerzos 36 mil')).toMatchObject({
      amount: 36_000,
      note: 'Dos almuerzos',
      categoryId: 'comida-almuerzo',
    });
  });

  it('fechas: ayer, antier, el lunes, el martes pasado', () => {
    expect(parse('almuerzo ayer 15 lucas').date).toBe('2026-11-09');
    expect(parse('antes de ayer cine 30 mil')).toMatchObject({
      date: '2026-11-08',
      categoryId: 'diversion',
    });
    expect(parse('antier taxi 12 mil').date).toBe('2026-11-08');
    expect(parse('el lunes mercado 80 mil')).toMatchObject({
      date: '2026-11-09',
      note: 'Mercado',
    });
    expect(parse('el martes pasado gasolina 100 mil').date).toBe('2026-11-03');
  });

  it('comercios conocidos', () => {
    expect(parse('netflix 26.900 tarjeta')).toMatchObject({
      merchant: 'Netflix',
      categoryId: 'suscripciones',
      note: null,
      accountId: 'acc-nu',
    });
    expect(parse('rappi 45 mil')).toMatchObject({
      merchant: 'Rappi',
      categoryId: 'domicilios',
    });
    expect(parse('4x1000 3.600')).toMatchObject({
      amount: 3600,
      categoryId: 'bancos-gmf',
    });
  });

  it('las palabras que le enseñaste mandan', () => {
    expect(parse('chuzo 8 mil')).toMatchObject({ categoryId: 'comida-rapida' });
    expect(parse('bancol almuerzo 20 mil')).toMatchObject({
      accountId: 'acc-banco',
    });
    expect(parse('dropi 500 mil')).toMatchObject({
      type: 'INCOME',
      categoryId: 'ventas',
    });
  });

  it('una cuenta nombrada dos veces es una sola', () => {
    expect(parse('nu tarjeta almuerzo 30 mil')).toMatchObject({
      type: 'EXPENSE',
      accountId: 'acc-nu',
    });
  });

  it('la nota conserva lo que dijo, sin rellenos en las puntas', () => {
    expect(parse('almuerzo con juan 30 mil en efectivo')).toMatchObject({
      note: 'Almuerzo con juan',
      accountId: 'acc-cash',
    });
    expect(parse('pan y leche 12 mil')).toMatchObject({
      note: 'Pan y leche',
      categoryId: 'comida-panaderia',
    });
  });

  it('lo que no entiende queda para enseñarlo', () => {
    expect(parse('xyzw 20 mil')).toMatchObject({
      categoryId: null,
      unknown: ['xyzw'],
    });
    expect(parse('almuerzo 20 mil').unknown).toEqual([]);
  });

  it('si una subcategoría está archivada, usa la principal', () => {
    const ctx = { ...CTX, categories: systemCategories(['comida-almuerzo']) };
    expect(parse('almuerzo 18 lucas', ctx).categoryId).toBe('comida');
  });

  it('sin cuentas no inventa ninguna', () => {
    expect(
      parse('almuerzo 18 lucas nequi', { ...CTX, accounts: [] }),
    ).toMatchObject({
      accountId: null,
      amount: 18_000,
    });
  });

  it('sin monto devuelve null', () => {
    expect(parse('almuerzo con juan').amount).toBeNull();
  });
});

describe('categoryFromText', () => {
  it('categoriza descripciones sueltas (los ingresos de antes)', () => {
    expect(categoryFromText('Salario noviembre', 'INCOME', CTX)).toBe(
      'salario',
    );
    expect(categoryFromText('Venta de la moto', 'INCOME', CTX)).toBe('ventas');
    expect(categoryFromText('Cualquier cosa', 'INCOME', CTX)).toBeNull();
  });
});

describe('datos', () => {
  it('las claves de las categorías son únicas', () => {
    const keys = SYSTEM_CATEGORIES.flatMap((c) => [
      c.key,
      ...(c.children ?? []).map((k) => k.key),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(SYSTEM_CATEGORY_COUNT);
  });

  it('las palabras ya vienen normalizadas', () => {
    for (const c of SYSTEM_CATEGORIES) {
      for (const seed of [c, ...(c.children ?? [])]) {
        for (const w of [
          ...(seed.words ?? []),
          ...Object.keys(seed.brands ?? {}),
        ]) {
          expect(normalizeKeyword(w)).toBe(w);
        }
      }
    }
  });
});
