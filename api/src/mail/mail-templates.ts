/**
 * Correos de HabitFer: texto plano + HTML sencillo con estilos en linea (lo que aguantan
 * Gmail, Outlook y la app Mail). Todo lo que escribe el usuario (nombres de habitos y tareas,
 * el mensaje del coach) pasa por escapeHtml. Funciones puras, con pruebas.
 */

export type MailContent = { subject: string; text: string; html: string };

type Button = { label: string; url: string; primary?: boolean };

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const C = {
  page: '#F6F2EE',
  card: '#FFFFFF',
  line: '#EDE4DC',
  ink: '#1F1712',
  body: '#3B2F27',
  muted: '#8C7B6F',
  ember: '#E8620C',
  emberSoft: '#FFF1E6',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** Una sola linea: el asunto nunca lleva saltos (y no se corta a la mitad de un emoji). */
function oneLine(s: string, max = 120): string {
  const flat = s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const chars = Array.from(flat);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : flat;
}

/**
 * Enlace del boton «Hecho» de los correos: la pagina /accion de la web lo confirma con un toque.
 * El token va en el fragmento (#), asi no queda en los registros de ningun servidor.
 */
export function actionLink(appUrl: string, token: string, title: string, label: string): string {
  const params = new URLSearchParams({ t: token, n: oneLine(title, 80), l: label });
  return `${appUrl}/accion#${params.toString()}`;
}

function buttonHtml(b: Button): string {
  const style = b.primary
    ? `display:inline-block;background:${C.ember};color:#FFFFFF;border:1px solid ${C.ember};`
    : `display:inline-block;background:${C.card};color:${C.ink};border:1px solid ${C.line};`;
  return `<a href="${escapeHtml(b.url)}" style="${style}font:600 15px/1.2 ${FONT};text-decoration:none;padding:13px 20px;border-radius:12px;margin:0 8px 8px 0;">${escapeHtml(b.label)}</a>`;
}

function layout(p: {
  appUrl: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  list?: string[];
  /** Párrafos después de la lista. */
  after?: string[];
  /** Viñeta de la lista (por defecto la llama; '' si los elementos ya traen su emoji). */
  bullet?: string;
  buttons: Button[];
  footer: string;
}): string {
  const toRows = (list: string[]) =>
    list
      .filter((t) => t.trim())
      .map(
        (t) =>
          `<tr><td style="padding:10px 24px 0;font:400 16px/1.55 ${FONT};color:${C.body};">${escapeHtml(t).replace(/\n/g, '<br>')}</td></tr>`,
      )
      .join('');
  const paragraphs = toRows(p.paragraphs);
  const after = toRows(p.after ?? []);
  const list = p.list?.length
    ? `<tr><td style="padding:12px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.emberSoft};border-radius:12px;">${p.list
        .map(
          (item) =>
            `<tr><td style="padding:9px 14px;font:500 15px/1.4 ${FONT};color:${C.ink};border-bottom:1px solid ${C.card};">${p.bullet === '' ? '' : `${escapeHtml(p.bullet ?? '🔥')}&nbsp; `}${escapeHtml(item)}</td></tr>`,
        )
        .join('')}</table></td></tr>`
    : '';
  const buttons = p.buttons.length
    ? `<tr><td style="padding:20px 24px 4px;">${p.buttons.map(buttonHtml).join('')}</td></tr>`
    : '';
  const settingsUrl = `${p.appUrl}/app/habitfer?avisos=1`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(p.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(p.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${C.card};border:1px solid ${C.line};border-radius:18px;">
<tr><td style="padding:22px 24px 4px;font:700 13px/1.4 ${FONT};color:${C.ember};letter-spacing:0.06em;text-transform:uppercase;">🔥 HabitFer</td></tr>
<tr><td style="padding:4px 24px 0;font:700 22px/1.3 ${FONT};color:${C.ink};">${escapeHtml(p.heading)}</td></tr>
${paragraphs}${list}${after}${buttons}
<tr><td style="padding:18px 24px 22px;font:400 12px/1.5 ${FONT};color:${C.muted};">${escapeHtml(p.footer)} <a href="${escapeHtml(settingsUrl)}" style="color:${C.muted};">Cambiar mis avisos</a></td></tr>
</table></td></tr></table>
</body></html>`;
}

function textVersion(p: {
  heading: string;
  paragraphs: string[];
  list?: string[];
  after?: string[];
  buttons: Button[];
  footer: string;
  appUrl: string;
}): string {
  const lines = [p.heading, '', ...p.paragraphs.filter((t) => t.trim())];
  if (p.list?.length) lines.push('', ...p.list.map((i) => `- ${i}`));
  for (const extra of (p.after ?? []).filter((t) => t.trim())) lines.push('', extra);
  if (p.buttons.length) lines.push('', ...p.buttons.map((b) => `${b.label}: ${b.url}`));
  lines.push('', '--', `${p.footer} Cambiar mis avisos: ${p.appUrl}/app/habitfer?avisos=1`);
  return lines.join('\n');
}

function build(p: {
  appUrl: string;
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  list?: string[];
  after?: string[];
  bullet?: string;
  buttons: Button[];
}): MailContent {
  const footer = 'Te llega porque activaste los avisos por correo en HabitFer.';
  const parts = { ...p, footer };
  return { subject: oneLine(p.subject), text: textVersion(parts), html: layout(parts) };
}

const openApp = (appUrl: string, path = '/app/habitfer'): Button => ({ label: 'Abrir HabitFer', url: `${appUrl}${path}` });

/** Recordatorio de un habito, con el boton para marcarlo (o sumar, en los medibles) sin abrir la app. */
export function habitReminderMail(p: {
  appUrl: string;
  icon: string | null;
  title: string;
  body: string;
  actionUrl: string | null;
  actionLabel: string;
}): MailContent {
  const buttons: Button[] = [];
  if (p.actionUrl) buttons.push({ label: `✓ ${p.actionLabel}`, url: p.actionUrl, primary: true });
  buttons.push(openApp(p.appUrl));
  return build({
    appUrl: p.appUrl,
    subject: `${p.icon?.trim() || '🔥'} ${p.title}`,
    preheader: p.body,
    heading: p.title,
    paragraphs: [p.body],
    buttons,
  });
}

/** Recordatorio de una tarea. */
export function taskReminderMail(p: { appUrl: string; title: string; body: string; actionUrl: string | null }): MailContent {
  const buttons: Button[] = [];
  if (p.actionUrl) buttons.push({ label: '✓ Marcar como hecha', url: p.actionUrl, primary: true });
  buttons.push({ label: 'Ver mis tareas', url: `${p.appUrl}/app/habitfer/tasks` });
  return build({
    appUrl: p.appUrl,
    subject: `☑️ ${p.title}`,
    preheader: p.body,
    heading: p.title,
    paragraphs: [p.body],
    buttons,
  });
}

/** FerFit: el día que toca entrenar. El botón abre el entreno guiado (o la semana, si son varias rutinas). */
export function workoutReminderMail(p: { appUrl: string; title: string; body: string; path: string }): MailContent {
  return build({
    appUrl: p.appUrl,
    subject: `🏋️ ${p.title}`,
    preheader: p.body,
    heading: p.title,
    paragraphs: [p.body],
    buttons: [
      { label: '▶ Empezar', url: `${p.appUrl}${p.path}`, primary: true },
      { ...openApp(p.appUrl, '/app/ferfit/semana'), label: 'Ver mi semana' },
    ],
  });
}

/** Resumen de la noche: lo que falta hoy, con la lista completa. */
export function summaryMail(p: { appUrl: string; title: string; body: string; items: string[] }): MailContent {
  return build({
    appUrl: p.appUrl,
    subject: p.title,
    preheader: p.body,
    heading: p.title,
    paragraphs: [p.body],
    list: p.items,
    buttons: [{ ...openApp(p.appUrl), label: 'Cerrar el día en HabitFer', primary: true }],
  });
}

/** El mensaje semanal del coach, completo. */
export function coachMail(p: { appUrl: string; text: string }): MailContent {
  const paragraphs = p.text
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean);
  return build({
    appUrl: p.appUrl,
    subject: '🔥 Tu coach de la semana',
    preheader: paragraphs[0] ?? '',
    heading: 'Tu coach de la semana',
    paragraphs,
    buttons: [{ ...openApp(p.appUrl, '/app/habitfer/stats'), primary: true }],
  });
}

/** Mensaje de la mañana: lo de hoy, la racha y la frase del día. */
export function morningMail(p: {
  appUrl: string;
  title: string;
  plan: string;
  spark: string;
  quote: { frase: string; autor: string };
  items: string[];
}): MailContent {
  const quote = `«${p.quote.frase}»${p.quote.autor ? `\n— ${p.quote.autor}` : ''}`;
  return build({
    appUrl: p.appUrl,
    subject: p.title,
    preheader: `${p.plan.replace(/:$/, '.')} ${p.spark}`,
    heading: p.title.replace(/^☀️\s*/, ''),
    paragraphs: [p.plan],
    list: p.items,
    bullet: '',
    after: [p.spark, quote],
    buttons: [{ ...openApp(p.appUrl), label: 'Empezar el día en HabitFer', primary: true }],
  });
}

/** Correo de prueba desde Notificaciones. */
export function testMail(p: { appUrl: string; name: string }): MailContent {
  const hello = p.name ? `¡Hola, ${p.name}!` : '¡Hola!';
  return build({
    appUrl: p.appUrl,
    subject: '🔥 Así te llegarán los recordatorios',
    preheader: 'Los avisos por correo de HabitFer ya funcionan.',
    heading: hello,
    paragraphs: [
      'Si estás leyendo esto, los avisos por correo de HabitFer ya funcionan.',
      'Cada recordatorio trae un botón para marcar el hábito como hecho sin abrir la app.',
    ],
    buttons: [{ ...openApp(p.appUrl), primary: true }],
  });
}
