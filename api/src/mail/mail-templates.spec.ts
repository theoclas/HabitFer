import {
  actionLink,
  coachMail,
  escapeHtml,
  habitReminderMail,
  morningMail,
  summaryMail,
  taskReminderMail,
  testMail,
} from './mail-templates';

const APP = 'https://habitfer.fersuastudio.com';

describe('plantillas de correo', () => {
  it('escapa el HTML de lo que escribe el usuario', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
    const mail = habitReminderMail({
      appUrl: APP,
      icon: '📚',
      title: '<script>alert(1)</script>',
      body: 'Es hora',
      actionUrl: null,
      actionLabel: 'Marcar como hecho',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('el enlace del boton lleva el token, el titulo y el texto en el fragmento', () => {
    const url = actionLink(APP, 'aaa.bbb.ccc', 'Leer 20 min', 'Sumar 10 minutos');
    expect(url.startsWith(`${APP}/accion#`)).toBe(true);
    const params = new URLSearchParams(url.split('#')[1]);
    expect(params.get('t')).toBe('aaa.bbb.ccc');
    expect(params.get('n')).toBe('Leer 20 min');
    expect(params.get('l')).toBe('Sumar 10 minutos');
  });

  it('recordatorio de habito: asunto con el icono, boton de accion y boton para abrir la app', () => {
    const actionUrl = actionLink(APP, 'tok', 'Leer', 'Marcar como hecho');
    const mail = habitReminderMail({ appUrl: APP, icon: '📚', title: 'Leer', body: 'Llevas 5 días seguidos.', actionUrl, actionLabel: 'Marcar como hecho' });
    expect(mail.subject).toBe('📚 Leer');
    expect(mail.html).toContain('✓ Marcar como hecho');
    expect(mail.html).toContain(escapeHtml(actionUrl));
    expect(mail.html).toContain(`${APP}/app/habitfer"`);
    expect(mail.text).toContain(`✓ Marcar como hecho: ${actionUrl}`);
    expect(mail.text).toContain('Llevas 5 días seguidos.');
    expect(mail.html).toContain(`${APP}/app/habitfer?avisos=1`);
  });

  it('sin icono usa la llama y el asunto nunca lleva saltos de linea', () => {
    const mail = habitReminderMail({ appUrl: APP, icon: '  ', title: 'Meditar\r\nBcc: otro@x.com', body: 'b', actionUrl: null, actionLabel: 'x' });
    expect(mail.subject).toBe('🔥 Meditar Bcc: otro@x.com');
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it('asuntos largos se cortan sin partir emojis', () => {
    const mail = taskReminderMail({ appUrl: APP, title: '🔥'.repeat(200), body: 'b', actionUrl: null });
    expect(Array.from(mail.subject).length).toBeLessThanOrEqual(120);
    expect(mail.subject.endsWith('…')).toBe(true);
    expect(mail.subject).not.toContain('�');
  });

  it('tarea: boton de marcar hecha y enlace a tareas', () => {
    const mail = taskReminderMail({ appUrl: APP, title: 'Llamar a Juan', body: 'Para las 15:00.', actionUrl: `${APP}/accion#t=x` });
    expect(mail.subject).toBe('☑️ Llamar a Juan');
    expect(mail.html).toContain('✓ Marcar como hecha');
    expect(mail.html).toContain(`${APP}/app/habitfer/tasks`);
  });

  it('resumen: lista completa de lo que falta', () => {
    const mail = summaryMail({
      appUrl: APP,
      title: '🔥 Tu racha está en riesgo',
      body: 'Te faltan 2: Leer y Correr.',
      items: ['Leer · racha de 12 días', 'Correr'],
    });
    expect(mail.subject).toBe('🔥 Tu racha está en riesgo');
    expect(mail.html).toContain('Leer · racha de 12 días');
    expect(mail.html).toContain('Correr');
    expect(mail.text).toContain('- Leer · racha de 12 días');
  });

  it('coach: un parrafo por bloque y los saltos simples como <br>', () => {
    const mail = coachMail({ appUrl: APP, text: 'Hola Fer.\n\nEsta semana leíste 5 días.\nSigue así.' });
    expect(mail.subject).toBe('🔥 Tu coach de la semana');
    expect(mail.html).toContain('Hola Fer.');
    expect(mail.html).toContain('Esta semana leíste 5 días.<br>Sigue así.');
    expect(mail.html).toContain(`${APP}/app/habitfer/stats`);
  });

  it('mañana: plan, lista sin la llama repetida, ánimo y frase con su autor', () => {
    const mail = morningMail({
      appUrl: APP,
      title: '☀️ Buenos días, Fernando',
      plan: 'Hoy tienes 1 hábito y 1 tarea:',
      spark: '🔥 Tu mejor racha: Leer, 12 días. Hoy la llevas a 13.',
      quote: { frase: 'Hoy cuenta aunque nadie te aplauda.', autor: 'Jhova de aquino' },
      items: ['🔥 Leer', '☑️ Llamar a Juan · 3:00 p. m.'],
    });
    expect(mail.subject).toBe('☀️ Buenos días, Fernando');
    expect(mail.html).toContain('>Buenos días, Fernando<');
    expect(mail.html).toContain('☑️ Llamar a Juan · 3:00 p. m.');
    expect(mail.html).not.toContain('🔥&nbsp; 🔥 Leer');
    expect(mail.text).toContain('Hoy tienes 1 hábito y 1 tarea:\n\n- 🔥 Leer\n- ☑️ Llamar a Juan · 3:00 p. m.\n\n🔥 Tu mejor racha');
    expect(mail.text).toContain('«Hoy cuenta aunque nadie te aplauda.»\n— Jhova de aquino');
  });

  it('prueba: saluda por el nombre', () => {
    expect(testMail({ appUrl: APP, name: 'Fer' }).html).toContain('¡Hola, Fer!');
    expect(testMail({ appUrl: APP, name: '' }).html).toContain('¡Hola!');
  });
});
