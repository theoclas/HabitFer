/**
 * Captura rapida: entiende "mañana 3pm llamar a Juan !alta #trabajo".
 * Sin dependencias (se prueba con el runner de Node). Fechas como claves YYYY-MM-DD.
 */

export type QuickPriority = "LOW" | "MEDIUM" | "HIGH";
export type QuickProject = { id: string; name: string };
export type QuickPartKind = "date" | "time" | "priority" | "project";

export type QuickTask = {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: QuickPriority;
  projectId: string | null;
  /** El #tag escrito (aunque no coincida con un proyecto). */
  projectTag: string | null;
  reminderEnabled: boolean;
  /** Lo que se reconocio, para mostrarlo como chips. */
  parts: { kind: QuickPartKind; text: string }[];
};

export type QuickNow = { todayKey: string; minutes: number };

const ACCENTS: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n", Á: "a", É: "e", Í: "i", Ó: "o", Ú: "u", Ü: "u", Ñ: "n" };

/** Minusculas y sin tildes, letra por letra (mismo largo que el original). */
function fold(s: string): string {
  let out = "";
  for (const ch of s) out += ch.length === 1 ? (ACCENTS[ch] ?? ch.toLowerCase()) : ch;
  return out;
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3));

function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dateToKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToKey(d);
}

function validDate(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? dateToKey(date) : null;
}

/** Dia y mes sin año: este año, o el siguiente si ya paso. */
function nextDayMonth(todayKey: string, day: number, month: number): string | null {
  const y = Number(todayKey.slice(0, 4));
  const thisYear = validDate(y, month, day);
  if (thisYear && thisYear >= todayKey) return thisYear;
  return validDate(y + 1, month, day);
}

function hhmm(h: number, m: number): string | null {
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function to24(h: number, period: string): number {
  const p = period.replace(/\./g, "").trim();
  if (p.startsWith("p") || p === "tarde" || p === "noche") return h === 12 ? 12 : h + 12;
  if (p.startsWith("a") || p === "manana") return h === 12 ? 0 : h;
  return h;
}

export function parseQuickTask(input: string, now: QuickNow, projects: QuickProject[] = []): QuickTask {
  let orig = input;
  let norm = fold(input);
  const parts: QuickTask["parts"] = [];
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let priority: QuickPriority = "MEDIUM";
  let projectId: string | null = null;
  let projectTag: string | null = null;

  /** Busca en el texto normalizado y borra lo reconocido de ambos textos. */
  const take = (re: RegExp, onMatch: (m: RegExpExecArray, text: string) => boolean) => {
    const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = rx.exec(norm))) {
      const text = orig.slice(m.index, m.index + m[0].length);
      if (onMatch(m, text.trim())) {
        const blank = " ".repeat(m[0].length);
        orig = orig.slice(0, m.index) + blank + orig.slice(m.index + m[0].length);
        norm = norm.slice(0, m.index) + blank + norm.slice(m.index + m[0].length);
        return;
      }
    }
  };

  // Prioridad.
  take(/(^|\s)(!{2,3}|!(alta|urgente|importante|high))(?=\s|$)/, (_m, text) => {
    priority = "HIGH";
    parts.push({ kind: "priority", text });
    return true;
  });
  take(/(^|\s)!(media|normal|medium)(?=\s|$)/, (_m, text) => {
    priority = "MEDIUM";
    parts.push({ kind: "priority", text });
    return true;
  });
  take(/(^|\s)!(baja|low)(?=\s|$)/, (_m, text) => {
    priority = "LOW";
    parts.push({ kind: "priority", text });
    return true;
  });

  // Proyecto: #nombre.
  take(/(^|\s)#([\w-]+)/, (m, text) => {
    const tag = m[2];
    projectTag = tag;
    const found =
      projects.find((p) => fold(p.name).replace(/\s+/g, "") === tag) ??
      projects.find((p) => fold(p.name).replace(/\s+/g, "").startsWith(tag)) ??
      projects.find((p) => fold(p.name).includes(tag));
    if (found) projectId = found.id;
    parts.push({ kind: "project", text: found ? found.name : text });
    return true;
  });

  // Hora: "3pm", "3:30 pm", "a las 5 de la tarde", "18:30", "18h", "mediodia", "por la mañana".
  const setTime = (value: string | null, text: string) => {
    if (!value || dueTime) return false;
    dueTime = value;
    parts.push({ kind: "time", text });
    return true;
  };
  take(/(^|\s)(a las |a la )?(\d{1,2})(:(\d{2}))?\s?(am|pm|a\.\s?m\.|p\.\s?m\.)(?=\s|$|[,.])/, (m, text) => {
    const h = Number(m[3]);
    if (h < 1 || h > 12) return false;
    return setTime(hhmm(to24(h, m[6]), Number(m[5] ?? 0)), text);
  });
  take(/(^|\s)a las? (\d{1,2})(:(\d{2}))? de la (manana|tarde|noche)(?=\s|$|[,.])/, (m, text) => {
    const h = Number(m[2]);
    if (h < 1 || h > 12) return false;
    return setTime(hhmm(to24(h, m[5]), Number(m[4] ?? 0)), text);
  });
  take(/(^|\s)(a las )?(\d{1,2}):(\d{2})(?=\s|$|[,.])/, (m, text) => setTime(hhmm(Number(m[3]), Number(m[4])), text));
  take(/(^|\s)(\d{1,2})h(?=\s|$|[,.])/, (m, text) => setTime(hhmm(Number(m[2]), 0), text));
  take(/(^|\s)a las? (\d{1,2})(?=\s|$|[,.])/, (m, text) => {
    const h = Number(m[2]);
    if (h < 1 || h > 12) return false;
    // Sin "am" ni "pm": de 1 a 6 se entiende de la tarde.
    return setTime(hhmm(h <= 6 ? h + 12 : h, 0), text);
  });
  take(/(^|\s)(al )?mediodia(?=\s|$|[,.])/, (_m, text) => setTime("12:00", text));
  take(/(^|\s)(por|en) la (manana|tarde|noche)(?=\s|$|[,.])/, (m, text) =>
    setTime(m[3] === "manana" ? "09:00" : m[3] === "tarde" ? "15:00" : "20:00", text),
  );

  // Fecha.
  const setDate = (value: string | null, text: string) => {
    if (!value || dueDate) return false;
    dueDate = value;
    parts.push({ kind: "date", text });
    return true;
  };
  take(/(^|\s)pasado manana(?=\s|$|[,.])/, (_m, text) => setDate(addDays(now.todayKey, 2), text));
  take(/(^|\s)manana(?=\s|$|[,.])/, (_m, text) => setDate(addDays(now.todayKey, 1), text));
  take(/(^|\s)hoy(?=\s|$|[,.])/, (_m, text) => setDate(now.todayKey, text));
  take(/(^|\s)en (\d{1,3}) (dias?|semanas?)(?=\s|$|[,.])/, (m, text) => {
    const n = Number(m[2]) * (m[3].startsWith("semana") ? 7 : 1);
    return n > 0 && n <= 730 ? setDate(addDays(now.todayKey, n), text) : false;
  });
  take(new RegExp(`(^|\\s)(el |este |proximo |el proximo )?(${WEEKDAYS.join("|")})(?=\\s|$|[,.])`), (m, text) => {
    const target = WEEKDAYS.indexOf(m[3]);
    const today = keyToDate(now.todayKey).getUTCDay();
    let delta = (target - today + 7) % 7;
    if (delta === 0) delta = 7;
    return setDate(addDays(now.todayKey, delta), text);
  });
  take(new RegExp(`(^|\\s)(el )?(\\d{1,2}) de (${MONTHS.join("|")})( de (\\d{4}))?(?=\\s|$|[,.])`), (m, text) => {
    const day = Number(m[3]);
    const month = MONTHS.indexOf(m[4]) + 1;
    return setDate(m[6] ? validDate(Number(m[6]), month, day) : nextDayMonth(now.todayKey, day, month), text);
  });
  take(new RegExp(`(^|\\s)(el )?(\\d{1,2}) (${MONTH_SHORT.join("|")})\\.?(?=\\s|$|[,.])`), (m, text) => {
    return setDate(nextDayMonth(now.todayKey, Number(m[3]), MONTH_SHORT.indexOf(m[4]) + 1), text);
  });
  take(/(^|\s)(el )?(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?(?=\s|$|[,.])/, (m, text) => {
    const day = Number(m[3]);
    const month = Number(m[4]);
    if (!m[6]) return setDate(nextDayMonth(now.todayKey, day, month), text);
    const year = m[6].length === 2 ? 2000 + Number(m[6]) : Number(m[6]);
    return setDate(validDate(year, month, day), text);
  });
  take(/(^|\s)el (\d{1,2})(?=\s|$|[,.])/, (m, text) => {
    const day = Number(m[2]);
    if (day < 1 || day > 31) return false;
    const [y, mo] = now.todayKey.split("-").map(Number);
    let value = validDate(y, mo, day);
    if (!value || value < now.todayKey) value = mo === 12 ? validDate(y + 1, 1, day) : validDate(y, mo + 1, day);
    return setDate(value, text);
  });

  // Hora sin fecha: hoy si todavia no pasa, si no mañana.
  if (dueTime && !dueDate) {
    const [h, m] = (dueTime as string).split(":").map(Number);
    dueDate = h * 60 + m > now.minutes ? now.todayKey : addDays(now.todayKey, 1);
  }

  let title = orig.replace(/\s+/g, " ").trim();
  title = title.replace(/^(para|el|la|de|a)\s+/i, "").replace(/\s+(para|el|la|de|a|y)$/i, "").trim();
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, dueDate, dueTime, priority, projectId, projectTag, reminderEnabled: Boolean(dueTime), parts };
}
