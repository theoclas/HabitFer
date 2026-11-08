import { buildSummaryText, habitReminderBody, habitReminderTimes, normalizeReminderTimes } from './reminder-text.utils';

describe('reminder-text.utils', () => {
  it('normaliza horas: validas, sin repetir, ordenadas, maximo 4', () => {
    expect(normalizeReminderTimes(['21:00', '07:30', 'x', '07:30', '25:00', 12, '06:00', '12:00', '18:45'])).toEqual([
      '06:00',
      '07:30',
      '12:00',
      '18:45',
    ]);
    expect(normalizeReminderTimes(null)).toEqual([]);
  });

  it('usa reminderTime cuando el habito es viejo y no tiene lista', () => {
    expect(habitReminderTimes({ reminderEnabled: true, reminderTime: '07:00', reminderTimes: [] })).toEqual(['07:00']);
    expect(habitReminderTimes({ reminderEnabled: true, reminderTime: '07:00', reminderTimes: ['21:00', '07:00'] })).toEqual([
      '07:00',
      '21:00',
    ]);
    expect(habitReminderTimes({ reminderEnabled: false, reminderTime: '07:00', reminderTimes: ['07:00'] })).toEqual([]);
  });

  it('el aviso habla de la racha', () => {
    expect(habitReminderBody(0)).toBe('Es hora de tu hábito.');
    expect(habitReminderBody(1)).toBe('Vas 1 día. Sigue encendiendo la racha.');
    expect(habitReminderBody(12)).toBe('Llevas 12 días seguidos: no la dejes apagar.');
  });

  it('arma el resumen nocturno con la racha en riesgo mas larga', () => {
    expect(buildSummaryText([])).toBeNull();
    expect(buildSummaryText([{ title: 'Leer', streak: 1, streakEnabled: true }])).toEqual({
      title: 'Todavía puedes cerrar el día',
      body: 'Te falta Leer.',
    });
    expect(
      buildSummaryText([
        { title: 'Leer', streak: 12, streakEnabled: true },
        { title: 'Agua', streak: 30, streakEnabled: false },
        { title: 'Mezclas', streak: 4, streakEnabled: true },
      ]),
    ).toEqual({
      title: '🔥 Tu racha está en riesgo',
      body: 'Te faltan 3: Leer, Agua y Mezclas. La racha de 12 días de Leer está en riesgo.',
    });
    expect(
      buildSummaryText(['A', 'B', 'C', 'D', 'E'].map((t) => ({ title: t, streak: 0, streakEnabled: true })))?.body,
    ).toBe('Te faltan 5: A, B y 3 más.');
  });
});
