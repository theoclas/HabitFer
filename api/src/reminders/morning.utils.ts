/** Mensaje de la mañana: lo de hoy, la racha que hay que cuidar y una frase (funciones puras, con pruebas). */
import { FRIEND_PHRASES, PHRASES, type Phrase } from './phrases.data';

export type MorningInput = {
  name: string;
  /** Hábitos que hoy se deben cumplir y faltan (los medibles con su avance). */
  pending: string[];
  /** Tareas de hoy sin terminar. */
  tasks: { title: string; dueTime: string | null }[];
  /** La racha más larga que sigue viva (2 o más). */
  best: { title: string; streak: number; unit: 'days' | 'weeks' } | null;
  /** Ayer se cumplió todo lo que se pedía. */
  yesterdayPerfect: boolean;
  quote: Phrase;
};

export type MorningText = {
  title: string;
  /** "Hoy tienes 6 hábitos y 2 tareas:" */
  plan: string;
  /** La línea de ánimo (racha o ayer perfecto). */
  spark: string;
  quote: Phrase;
  /** Lo de hoy, uno por línea (para el correo y WhatsApp). */
  items: string[];
  /** Texto corto para la notificación del teléfono. */
  pushBody: string;
};

/** Peso de las frases de Jhova, Feristoteles y Petlon (igual que el banner de la app). */
const FRIENDS_WEIGHT = 0.7;

/** Número estable a partir de un texto (FNV-1a de 32 bits). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Frase del día: la misma para un usuario en un día, distinta entre días. */
export function pickPhrase(seed: string, friends: Phrase[] = FRIEND_PHRASES, all: Phrase[] = PHRASES): Phrase {
  const h = hash(seed);
  const useFriends = friends.length > 0 && (h % 1000) / 1000 < FRIENDS_WEIGHT;
  const pool = useFriends ? friends : all.length ? all : friends;
  return pool[Math.floor(h / 1000) % pool.length];
}

/** "15:00" → "3:00 p. m." */
export function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildMorning(p: MorningInput): MorningText {
  const n = p.pending.length;
  const k = p.tasks.length;
  const title = p.name ? `☀️ Buenos días, ${p.name}` : '☀️ Buenos días';

  const parts = [n ? plural(n, 'hábito', 'hábitos') : '', k ? plural(k, 'tarea', 'tareas') : ''].filter(Boolean);
  const plan = parts.length
    ? `Hoy tienes ${parts.join(' y ')}:`
    : 'Hoy no tienes nada pendiente: día libre para descansar o adelantar algo.';

  let spark: string;
  const best = p.best;
  const unitWord = best ? (best.unit === 'weeks' ? (best.streak === 1 ? 'semana' : 'semanas') : best.streak === 1 ? 'día' : 'días') : '';
  if (best && p.yesterdayPerfect) {
    spark =
      best.unit === 'days'
        ? `Ayer cumpliste todo y ${best.title} va en ${best.streak} ${unitWord}. ¡Hoy la llevas a ${best.streak + 1}! 💪`
        : `Ayer cumpliste todo y ${best.title} va en ${best.streak} ${unitWord} seguidas. 💪`;
  } else if (best) {
    spark =
      best.unit === 'days'
        ? `🔥 Tu mejor racha: ${best.title}, ${best.streak} ${unitWord}. Hoy la llevas a ${best.streak + 1}.`
        : `🔥 Tu mejor racha: ${best.title}, ${best.streak} ${unitWord} seguidas.`;
  } else if (p.yesterdayPerfect) {
    spark = 'Ayer cumpliste todo. Hoy, igual. 💪';
  } else {
    spark = n ? 'Hoy es un buen día para encender una racha. 🔥' : 'Un día tranquilo también suma. 🌿';
  }

  const items = [
    ...p.pending.map((t) => `🔥 ${t}`),
    ...p.tasks.map((t) => (t.dueTime ? `☑️ ${t.title} · ${formatHour(t.dueTime)}` : `☑️ ${t.title}`)),
  ];

  const short = parts.length ? `Hoy tienes ${parts.join(' y ')}.` : 'Hoy no tienes nada pendiente.';
  const quote = `«${p.quote.frase}»`;
  const full = `${short} ${quote}`;
  const pushBody = full.length <= 180 ? full : `${short} ${best ? `Tu mejor racha: ${best.title}, ${best.streak} ${unitWord} 🔥` : 'Tú puedes. 💪'}`;

  return { title, plan, spark, quote: p.quote, items, pushBody };
}
