import { clampInt, cleanText, csvCell, normTitle, oneOf, toCsv, validDateKey } from './export.utils';

describe('export.utils', () => {
  it('escapa celdas de CSV', () => {
    expect(csvCell('Agua')).toBe('Agua');
    expect(csvCell('con, coma')).toBe('"con, coma"');
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCell('dos\nlineas')).toBe('"dos\nlineas"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(8)).toBe('8');
  });

  it('arma el CSV con BOM y CRLF', () => {
    expect(toCsv([['fecha', 'hábito'], ['2026-11-08', 'Leer, mucho']])).toBe('﻿fecha,hábito\r\n2026-11-08,"Leer, mucho"\r\n');
  });

  it('valida fechas reales y no futuras', () => {
    expect(validDateKey('2026-11-08', '2026-11-08')).toBe('2026-11-08');
    expect(validDateKey('2026-11-09', '2026-11-08')).toBeNull();
    expect(validDateKey('2026-02-30', '2026-11-08')).toBeNull();
    expect(validDateKey('08/11/2026', '2026-11-08')).toBeNull();
    expect(validDateKey(20261108, '2026-11-08')).toBeNull();
  });

  it('limpia numeros, textos y opciones', () => {
    expect(clampInt(9.6, 1, 7, 3)).toBe(7);
    expect(clampInt('x', 1, 7, 3)).toBe(3);
    expect(cleanText('  hola  ', 3)).toBe('hol');
    expect(cleanText('   ', 10)).toBeNull();
    expect(normTitle('  Sin Azúcar ')).toBe('sin azucar');
    expect(oneOf('QUIT', ['BUILD', 'QUIT'] as const, 'BUILD')).toBe('QUIT');
    expect(oneOf('OTRO', ['BUILD', 'QUIT'] as const, 'BUILD')).toBe('BUILD');
  });
});
