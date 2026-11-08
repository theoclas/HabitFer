/**
 * La sesión en este dispositivo: el token (la API también lo deja en una cookie) y el último usuario
 * conocido, para abrir la app sin señal o mientras el servidor se reinicia.
 * La sesión dura un año y se renueva sola al abrir la app (ver tokenNeedsRenewal).
 */
import type { AuthUser } from "../types";

const TOKEN_KEY = "habitfer_token";
const USER_KEY = "habitfer_user";
const HOUR_S = 60 * 60;
/** Renovar como mucho cada 12 horas. */
const RENEW_AFTER_S = 12 * HOUR_S;
/** Los tokens de antes duraban 8 horas: uno que dure menos que esto se cambia por uno de un año. */
const LONG_SESSION_S = 300 * 24 * HOUR_S;

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  try {
    return store()?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    store()?.setItem(TOKEN_KEY, token);
  } catch {
    /* sin almacenamiento: queda la cookie */
  }
}

export function saveSessionUser(user: AuthUser): void {
  try {
    store()?.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* sin almacenamiento */
  }
}

/** El último usuario que abrió la app en este dispositivo (null si no hay o no se puede leer). */
export function readSessionUser(): AuthUser | null {
  try {
    const raw = store()?.getItem(USER_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const user = value as Partial<AuthUser>;
    return typeof user.id === "string" && typeof user.username === "string" ? (user as AuthUser) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    const s = store();
    s?.removeItem(TOKEN_KEY);
    s?.removeItem(USER_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

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

/**
 * ¿Toca pedir un token nuevo? Sí si no hay (sesión solo con la cookie), si no se puede leer, si es de
 * los cortos de antes o si ya tiene 12 horas. Quien decide si la sesión sirve es el servidor.
 */
export function tokenNeedsRenewal(token: string | null, now = Date.now()): boolean {
  if (!token) return true;
  const claims = readClaims(token);
  const iat = typeof claims?.iat === "number" ? claims.iat : null;
  const exp = typeof claims?.exp === "number" ? claims.exp : null;
  if (iat == null || exp == null) return true;
  if (exp - iat < LONG_SESSION_S) return true;
  return now / 1000 - iat >= RENEW_AFTER_S;
}
