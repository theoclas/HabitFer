import { coachText, formatPhone, habitText, maskPhone, normalizePhone, summaryText, taskText, testText } from './whatsapp-text';

describe('números de WhatsApp', () => {
  it('normaliza celulares colombianos con o sin indicativo', () => {
    expect(normalizePhone('+57 300 123 4567')).toBe('573001234567');
    expect(normalizePhone('300 123 4567')).toBe('573001234567');
    expect(normalizePhone('(300) 123-4567')).toBe('573001234567');
    expect(normalizePhone('0057 300 1234567')).toBe('573001234567');
    expect(normalizePhone('+34 612 345 678')).toBe('34612345678');
  });

  it('rechaza lo que no es un número', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('hola')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('1234567890123456')).toBeNull();
  });

  it('formato para mostrar y para los registros', () => {
    expect(formatPhone('573001234567')).toBe('+57 300 123 4567');
    expect(formatPhone('34612345678')).toBe('+34612345678');
    expect(maskPhone('573001234567')).toBe('+57300***4567');
  });
});

describe('textos de WhatsApp', () => {
  it('hábito: título en negrita, cuerpo y enlace corto', () => {
    const text = habitText({ icon: '📚', title: 'Leer *20* min', body: 'Llevas 5 días seguidos.', link: 'https://h.co/a/abc', label: 'Marcar como hecho' });
    expect(text).toBe('📚 *Leer 20 min*\nLlevas 5 días seguidos.\n\n✓ Marcar como hecho: https://h.co/a/abc');
  });

  it('hábito sin icono ni enlace', () => {
    expect(habitText({ icon: null, title: 'Meditar', body: 'Es hora de tu hábito.', link: null, label: 'x' })).toBe(
      '🔥 *Meditar*\nEs hora de tu hábito.',
    );
  });

  it('tarea con enlace', () => {
    expect(taskText({ title: 'Llamar a Juan', body: 'Para las 15:00.', link: 'https://h.co/a/x' })).toBe(
      '☑️ *Llamar a Juan*\nPara las 15:00.\n\n✓ Marcar como hecha: https://h.co/a/x',
    );
  });

  it('resumen: lista y enlace para cerrar el día; más de 12 se resume', () => {
    const items = Array.from({ length: 14 }, (_, i) => `Hábito ${i + 1}`);
    const text = summaryText({ title: '🔥 Tu racha está en riesgo', body: 'Te faltan 14.', items, appUrl: 'https://h.co' });
    expect(text.startsWith('*🔥 Tu racha está en riesgo*\nTe faltan 14.\n\n• Hábito 1\n')).toBe(true);
    expect(text).toContain('• Hábito 12\n• y 2 más');
    expect(text).not.toContain('Hábito 13');
    expect(text.endsWith('Cerrar el día: https://h.co/app/habitfer')).toBe(true);
  });

  it('coach y prueba', () => {
    expect(coachText({ text: '  Hola Fer.\n\nSigue así.  ' })).toBe('🔥 *Tu coach de la semana*\n\nHola Fer.\n\nSigue así.');
    expect(testText({ name: 'Fernando' })).toContain('¡Hola, Fernando! Así te llegarán los recordatorios por WhatsApp.');
    expect(testText({ name: '' })).toContain('¡Hola! Así te llegarán');
  });
});
