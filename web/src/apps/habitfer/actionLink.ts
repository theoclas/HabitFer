/**
 * Enlace del botón «Hecho» de los correos: /accion#t=<token>&n=<título>&l=<texto del botón>.
 * El token es el mismo de los botones de las notificaciones (JWT de 36 h firmado por la API);
 * aquí solo se lee su contenido para mostrar qué va a pasar. Quien decide es el servidor.
 */
import type { PushActionResult } from "../../api/client";

export type ActionKind = "habit-done" | "habit-add" | "task-done";

export type ActionLink = {
  token: string;
  /** Nombre del hábito o de la tarea (viene en el enlace, solo para mostrarlo). */
  title: string;
  /** Texto del botón: «Marcar como hecho», «Sumar 10 minutos»… */
  label: string;
  act: ActionKind | null;
  /** Día del hábito (AAAA-MM-DD) si el token lo trae. */
  date: string | null;
  /** El token ya venció (se sabe sin preguntarle al servidor). */
  expired: boolean;
  /** De dónde viene el enlace: los correos no traen `s`; el enlace corto de WhatsApp trae `s=wa`. */
  source: "mail" | "whatsapp";
};

const KINDS: readonly ActionKind[] = ["habit-done", "habit-add", "task-done"];

/** Lee el cuerpo de un JWT (base64url) sin validarlo. null si no se puede leer. */
function readClaims(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Lee el fragmento del enlace. null si no trae token. */
export function parseActionHash(hash: string, now = Date.now()): ActionLink | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get("t")?.trim();
  if (!token) return null;
  const claims = readClaims(token);
  const act = KINDS.find((k) => k === claims?.act) ?? null;
  const date = typeof claims?.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(claims.d) ? claims.d : null;
  const exp = typeof claims?.exp === "number" ? claims.exp : null;
  return {
    token,
    title: (params.get("n") ?? "").trim().slice(0, 120),
    label: (params.get("l") ?? "").trim().slice(0, 60),
    act,
    date,
    expired: exp !== null && exp * 1000 <= now,
    source: params.get("s") === "wa" ? "whatsapp" : "mail",
  };
}

/** Texto del botón si el enlace no lo trae. */
export function defaultLabel(act: ActionKind | null): string {
  if (act === "task-done") return "Marcar como hecha";
  if (act === "habit-add") return "Sumar";
  return "Marcar como hecho";
}

/** La confirmación, con los mismos textos que la notificación del teléfono (web/sw/sw.template.js). */
export function describeResult(r: PushActionResult): { title: string; body: string; trophy: boolean } {
  const name = r.title?.trim() || (r.kind === "task" ? "Tarea" : "Hábito");
  if (r.kind === "habit" && r.achievement) {
    const what = r.achievement.headline || `${r.achievement.days} días`;
    return { title: "🏆 Logro desbloqueado", body: `${name} · ${what} · «${r.achievement.label}»`, trophy: true };
  }
  if (r.kind === "habit") {
    // En los medibles el botón suma: «3 de 8 vasos» (con ✓ solo si ya llegó a la meta).
    if (r.message) return { title: r.done === false ? name : `✓ ${name}`, body: r.message, trophy: false };
    const streak = r.streak ?? 0;
    const body =
      streak > 1 ? (r.streakUnit === "weeks" ? `Racha de ${streak} semanas 🔥` : `Racha de ${streak} días 🔥`) : "¡Bien hecho!";
    return { title: `✓ ${name}`, body, trophy: false };
  }
  return { title: `✓ ${name}`, body: "Tarea completada.", trophy: false };
}
