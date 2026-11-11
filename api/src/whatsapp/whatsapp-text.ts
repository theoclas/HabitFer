/** Números y textos de los avisos por WhatsApp (funciones puras, con pruebas). */

/** Cuántos números de WhatsApp puede tener cada usuario. */
export const MAX_WHATSAPP_NUMBERS = 2;

/** "+57 300 123 4567", "3001234567", "0057…" → "573001234567". null si no parece un número. */
export function normalizePhone(input: string): string | null {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Celular colombiano sin indicativo: 10 dígitos que empiezan por 3.
  if (digits.length === 10 && digits.startsWith('3')) digits = `57${digits}`;
  if (digits.length < 10 || digits.length > 15 || digits.startsWith('0')) return null;
  return digits;
}

/** "573001234567" → "+57 300 123 4567"; otros países: "+34612345678". */
export function formatPhone(digits: string): string {
  if (/^57\d{10}$/.test(digits)) return `+57 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return `+${digits}`;
}

/** "+57 300 *** 4567": para los registros. */
export function maskPhone(digits: string): string {
  return digits.length > 6 ? `+${digits.slice(0, 5)}***${digits.slice(-4)}` : '***';
}

const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
/** Negrita de WhatsApp (*así*), sin romperla si el texto trae asteriscos. */
const bold = (s: string) => `*${oneLine(s).replace(/\*/g, '')}*`;

const MAX_ITEMS = 12;

/** Aviso de un hábito; el enlace corto abre la confirmación de «Hecho». */
export function habitText(p: { icon: string | null; title: string; body: string; link: string | null; label: string }): string {
  const lines = [`${p.icon?.trim() || '🔥'} ${bold(p.title)}`, oneLine(p.body)];
  if (p.link) lines.push('', `✓ ${p.label}: ${p.link}`);
  return lines.join('\n');
}

/** FerFit: el día que toca entrenar, con el enlace al entreno guiado. */
export function workoutText(p: { title: string; body: string; link: string }): string {
  return [`🏋️ ${bold(p.title)}`, oneLine(p.body), '', `▶ Empezar: ${p.link}`].join('\n');
}

export function taskText(p: { title: string; body: string; link: string | null }): string {
  const lines = [`☑️ ${bold(p.title)}`, oneLine(p.body)];
  if (p.link) lines.push('', `✓ Marcar como hecha: ${p.link}`);
  return lines.join('\n');
}

/** Resumen de la noche con la lista de lo que falta. */
export function summaryText(p: { title: string; body: string; items: string[]; appUrl: string }): string {
  const items = p.items.slice(0, MAX_ITEMS).map((i) => `• ${oneLine(i)}`);
  if (p.items.length > MAX_ITEMS) items.push(`• y ${p.items.length - MAX_ITEMS} más`);
  const lines = [bold(p.title), oneLine(p.body)];
  if (items.length) lines.push('', ...items);
  lines.push('', `Cerrar el día: ${p.appUrl}/app/habitfer`);
  return lines.join('\n');
}

/** Mensaje de la mañana: lo de hoy, la racha y la frase del día (en cursiva). */
export function morningText(p: {
  title: string;
  plan: string;
  spark: string;
  quote: { frase: string; autor: string };
  items: string[];
  appUrl: string;
}): string {
  const items = p.items.slice(0, MAX_ITEMS).map(oneLine);
  if (p.items.length > MAX_ITEMS) items.push(`y ${p.items.length - MAX_ITEMS} más`);
  const quote = `_«${oneLine(p.quote.frase).replace(/_/g, '')}»_${p.quote.autor ? ` — ${oneLine(p.quote.autor)}` : ''}`;
  const lines = [bold(p.title), oneLine(p.plan)];
  if (items.length) lines.push(...items);
  lines.push('', oneLine(p.spark), '', quote, '', `Abrir HabitFer: ${p.appUrl}/app/habitfer`);
  return lines.join('\n');
}

export function coachText(p: { text: string }): string {
  return [`🔥 ${bold('Tu coach de la semana')}`, '', p.text.trim()].join('\n');
}

export function testText(p: { name: string }): string {
  return [
    `🔥 ${bold('HabitFer')}`,
    `${p.name ? `¡Hola, ${p.name}!` : '¡Hola!'} Así te llegarán los recordatorios por WhatsApp.`,
    'Cada aviso de un hábito trae un enlace para marcarlo como hecho.',
  ].join('\n');
}
