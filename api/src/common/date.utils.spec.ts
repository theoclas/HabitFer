import { parseDateKey, toDateKey, toIsoWeekday } from './date.utils';

describe('date.utils', () => {
  it('round-trips calendar dates via UTC (fixes UTC-5 off-by-one from MySQL DATE)', () => {
    const key = '2026-07-04';
    const date = parseDateKey(key);
    expect(toDateKey(date)).toBe(key);
    expect(toIsoWeekday(date)).toBe(6); // Saturday
  });

  it('does not shift a stored UTC midnight date to the previous local day', () => {
    const fromDb = new Date('2026-07-04T00:00:00.000Z');
    expect(toDateKey(fromDb)).toBe('2026-07-04');
  });
});
