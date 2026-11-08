import { buildMorning, formatHour, pickPhrase, type MorningInput } from './morning.utils';
import { FRIEND_PHRASES, PHRASES } from './phrases.data';

const quote = { frase: 'Cuando quieras parar, baja un cambio; no te bajes del camino.', autor: 'Petlon' };
const base: MorningInput = { name: 'Fernando', pending: [], tasks: [], best: null, yesterdayPerfect: false, quote };

describe('mensaje de la mañana', () => {
  it('saluda por el nombre y lista hábitos y tareas', () => {
    const m = buildMorning({
      ...base,
      pending: ['Flexiones', 'Agua (2/8 vasos)'],
      tasks: [
        { title: 'Llamar a Juan', dueTime: '15:00' },
        { title: 'Pagar la luz', dueTime: null },
      ],
    });
    expect(m.title).toBe('☀️ Buenos días, Fernando');
    expect(m.plan).toBe('Hoy tienes 2 hábitos y 2 tareas:');
    expect(m.items).toEqual(['🔥 Flexiones', '🔥 Agua (2/8 vasos)', '☑️ Llamar a Juan · 3:00 p. m.', '☑️ Pagar la luz']);
    expect(m.pushBody).toBe(`Hoy tienes 2 hábitos y 2 tareas. «${quote.frase}»`);
  });

  it('singulares y día libre', () => {
    expect(buildMorning({ ...base, pending: ['Leer'] }).plan).toBe('Hoy tienes 1 hábito:');
    expect(buildMorning({ ...base, tasks: [{ title: 'X', dueTime: null }] }).plan).toBe('Hoy tienes 1 tarea:');
    const free = buildMorning(base);
    expect(free.plan).toBe('Hoy no tienes nada pendiente: día libre para descansar o adelantar algo.');
    expect(free.spark).toBe('Un día tranquilo también suma. 🌿');
    expect(free.title).toBe('☀️ Buenos días, Fernando');
    expect(buildMorning({ ...base, name: '' }).title).toBe('☀️ Buenos días');
  });

  it('la línea de ánimo usa la mejor racha y si ayer fue perfecto', () => {
    const best = { title: 'Leer', streak: 12, unit: 'days' as const };
    expect(buildMorning({ ...base, pending: ['Leer'], best }).spark).toBe('🔥 Tu mejor racha: Leer, 12 días. Hoy la llevas a 13.');
    expect(buildMorning({ ...base, pending: ['Leer'], best, yesterdayPerfect: true }).spark).toBe(
      'Ayer cumpliste todo y Leer va en 12 días. ¡Hoy la llevas a 13! 💪',
    );
    expect(buildMorning({ ...base, pending: ['Correr'], best: { title: 'Correr', streak: 3, unit: 'weeks' } }).spark).toBe(
      '🔥 Tu mejor racha: Correr, 3 semanas seguidas.',
    );
    expect(buildMorning({ ...base, pending: ['Leer'], yesterdayPerfect: true }).spark).toBe('Ayer cumpliste todo. Hoy, igual. 💪');
    expect(buildMorning({ ...base, pending: ['Leer'] }).spark).toBe('Hoy es un buen día para encender una racha. 🔥');
  });

  it('si la frase es muy larga, la notificación usa la racha', () => {
    const long = { frase: 'x'.repeat(200), autor: 'Alguien' };
    const m = buildMorning({ ...base, pending: ['Leer'], quote: long, best: { title: 'Leer', streak: 5, unit: 'days' } });
    expect(m.pushBody).toBe('Hoy tienes 1 hábito. Tu mejor racha: Leer, 5 días 🔥');
  });

  it('horas en formato de 12 horas', () => {
    expect(formatHour('07:05')).toBe('7:05 a. m.');
    expect(formatHour('00:30')).toBe('12:30 a. m.');
    expect(formatHour('12:00')).toBe('12:00 p. m.');
    expect(formatHour('23:59')).toBe('11:59 p. m.');
  });

  it('la frase del día es estable para un usuario y un día, y casi siempre de los amigos', () => {
    expect(pickPhrase('u1:2026-11-08')).toEqual(pickPhrase('u1:2026-11-08'));
    const days = Array.from({ length: 400 }, (_, i) => pickPhrase(`u1:dia-${i}`));
    const friends = days.filter((p) => FRIEND_PHRASES.includes(p)).length;
    expect(friends / days.length).toBeGreaterThan(0.6);
    expect(friends / days.length).toBeLessThan(0.8);
    expect(days.every((p) => FRIEND_PHRASES.includes(p) || PHRASES.includes(p))).toBe(true);
    expect(new Set(days.map((p) => p.frase)).size).toBeGreaterThan(50);
  });
});
