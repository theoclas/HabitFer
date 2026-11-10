import { parseDateKey, toDateKey } from '../common/date.utils';
import {
  addMonthsClamped,
  daysBetween,
  generateInstallmentDrafts,
  isDateKey,
  legacyAddMonths,
  legacyDateFixes,
  MAX_INSTALLMENTS,
  monthEndKey,
  parseRange,
  planDrafts,
} from './fernance.utils';

const keys = (dates: Date[]) => dates.map(toDateKey);

describe('isDateKey', () => {
  it('acepta fechas reales y rechaza las imposibles', () => {
    expect(isDateKey('2026-11-09')).toBe(true);
    expect(isDateKey('2028-02-29')).toBe(true);
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-11-9')).toBe(false);
    expect(isDateKey('9/11/2026')).toBe(false);
    expect(isDateKey(20261109)).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
  });
});

describe('addMonthsClamped', () => {
  it('del 31 de octubre pasa al 30 de noviembre y vuelve al 31', () => {
    const anchor = parseDateKey('2026-10-31');
    expect(
      keys([0, 1, 2, 3, 4].map((k) => addMonthsClamped(anchor, k))),
    ).toEqual([
      '2026-10-31',
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
    ]);
  });

  it('respeta los años bisiestos', () => {
    expect(toDateKey(addMonthsClamped(parseDateKey('2028-01-31'), 1))).toBe(
      '2028-02-29',
    );
    expect(toDateKey(addMonthsClamped(parseDateKey('2027-01-30'), 1))).toBe(
      '2027-02-28',
    );
  });

  it('nunca deja un mes sin cuota ni pone dos en el mismo mes', () => {
    for (const day of [
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2026-08-31',
      '2026-12-30',
    ]) {
      const months = Array.from({ length: 24 }, (_, k) =>
        toDateKey(addMonthsClamped(parseDateKey(day), k)).slice(0, 7),
      );
      expect(new Set(months).size).toBe(24);
    }
  });

  it('el cálculo viejo sí se saltaba febrero (por eso se corrige)', () => {
    expect(toDateKey(legacyAddMonths(parseDateKey('2027-01-31'), 1))).toBe(
      '2027-03-03',
    );
  });
});

describe('generateInstallmentDrafts', () => {
  it('cuotas enteras: la última lleva lo que falte y no sobra un centavo', () => {
    const drafts = generateInstallmentDrafts(
      1_000_000,
      333_333.33,
      parseDateKey('2026-12-05'),
    );
    expect(drafts.map((d) => d.amount)).toEqual([333_333, 333_333, 333_333, 1]);
    const exact = generateInstallmentDrafts(
      1_200_000,
      300_000,
      parseDateKey('2026-10-31'),
    );
    expect(exact.map((d) => d.amount)).toEqual([
      300_000, 300_000, 300_000, 300_000,
    ]);
    expect(keys(exact.map((d) => d.dueDate))).toEqual([
      '2026-10-31',
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
    ]);
  });

  it('la suma siempre da el total', () => {
    const drafts = generateInstallmentDrafts(
      7_250_000,
      600_000,
      parseDateKey('2026-09-15'),
    );
    expect(drafts.reduce((s, d) => s + d.amount, 0)).toBe(7_250_000);
    expect(drafts).toHaveLength(13);
    expect(drafts.at(-1)?.amount).toBe(50_000);
  });

  it('rechaza cuotas mayores que el total, valores en cero y planes eternos', () => {
    expect(() =>
      generateInstallmentDrafts(100, 200, parseDateKey('2026-01-01')),
    ).toThrow('La cuota no puede ser mayor');
    expect(() =>
      generateInstallmentDrafts(0, 0, parseDateKey('2026-01-01')),
    ).toThrow('al menos $ 1');
    expect(() =>
      generateInstallmentDrafts(10_000_000, 1_000, parseDateKey('2026-01-01')),
    ).toThrow(`el máximo es ${MAX_INSTALLMENTS}`);
  });
});

describe('planDrafts', () => {
  it('arma el plan de lo que falta, con una última cuota distinta', () => {
    const drafts = planDrafts(3, 509_206, parseDateKey('2027-01-31'), 120_000);
    expect(keys(drafts.map((d) => d.dueDate))).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
    ]);
    expect(drafts.map((d) => d.amount)).toEqual([509_206, 509_206, 120_000]);
  });

  it('valida el número de cuotas y los valores', () => {
    expect(() => planDrafts(0, 1000, parseDateKey('2027-01-01'))).toThrow(
      'entre 1 y',
    );
    expect(() => planDrafts(2, 0, parseDateKey('2027-01-01'))).toThrow(
      'al menos $ 1',
    );
  });
});

describe('legacyDateFixes', () => {
  const row = (id: string, key: string, status = 'PENDING') => ({
    id,
    dueDate: parseDateKey(key),
    status,
  });

  it('corrige solo las pendientes que quedaron corridas', () => {
    // Lo que creaba el generador viejo con la primera cuota el 31 de octubre.
    const fixes = legacyDateFixes([
      row('a', '2026-10-31', 'PAID'),
      row('b', '2026-12-01'),
      row('c', '2026-12-31'),
      row('d', '2027-01-31'),
    ]);
    expect(fixes.map((f) => [f.id, toDateKey(f.dueDate)])).toEqual([
      ['b', '2026-11-30'],
    ]);
  });

  it('desde el 31 de enero: febrero, abril y junio vuelven a su mes', () => {
    const anchor = parseDateKey('2027-01-31');
    const old = [0, 1, 2, 3, 4, 5].map((k, i) =>
      row(String(i), toDateKey(legacyAddMonths(anchor, k))),
    );
    expect(old.map((o) => toDateKey(o.dueDate))).toEqual([
      '2027-01-31',
      '2027-03-03',
      '2027-03-31',
      '2027-05-01',
      '2027-05-31',
      '2027-07-01',
    ]);
    const fixed = legacyDateFixes(old).map((f) => toDateKey(f.dueDate));
    expect(fixed).toEqual(['2027-02-28', '2027-04-30', '2027-06-30']);
  });

  it('no toca pagadas, ni créditos que empiezan antes del 29, ni fechas que alguien cambió', () => {
    expect(
      legacyDateFixes([row('a', '2026-10-31'), row('b', '2026-12-01', 'PAID')]),
    ).toEqual([]);
    expect(
      legacyDateFixes([row('a', '2026-10-15'), row('b', '2026-11-15')]),
    ).toEqual([]);
    expect(
      legacyDateFixes([row('a', '2026-10-31'), row('b', '2026-11-28')]),
    ).toEqual([]);
  });
});

describe('parseRange', () => {
  it('sin fechas es el mes de hoy', () => {
    expect(parseRange(undefined, undefined, '2026-02-10')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('completa la fecha que falte con el mes de la otra', () => {
    expect(parseRange('2026-01-01', undefined, '2026-11-09')).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(parseRange(undefined, '2026-03-15', '2026-11-09')).toEqual({
      from: '2026-03-01',
      to: '2026-03-15',
    });
  });

  it('rechaza fechas imposibles y rangos al revés', () => {
    expect(() => parseRange('2026-02-30', '2026-03-01')).toThrow(
      '«desde» no es válida',
    );
    expect(() => parseRange('2026-03-01', '2026-02-01')).toThrow('va después');
  });

  it('monthEndKey sabe cuántos días tiene cada mes', () => {
    expect(monthEndKey(2026, 2)).toBe('2026-02-28');
    expect(monthEndKey(2028, 2)).toBe('2028-02-29');
    expect(monthEndKey(2026, 11)).toBe('2026-11-30');
  });
});

describe('daysBetween', () => {
  it('cuenta días de calendario', () => {
    expect(daysBetween('2026-10-31', '2026-11-09')).toBe(9);
    expect(daysBetween('2026-11-09', '2026-11-09')).toBe(0);
    expect(daysBetween('2026-11-10', '2026-11-09')).toBe(-1);
  });
});
