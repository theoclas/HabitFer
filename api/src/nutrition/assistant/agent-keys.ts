import { createHash, randomBytes } from 'node:crypto';

/** Las llaves del asistente empiezan así (las del atajo de iOS empiezan con «nf_»). */
export const AGENT_KEY_PREFIX = 'nfa_';
/** Máximo de llaves por persona. */
export const MAX_AGENT_KEYS = 10;
/** Nombre si no se pone uno. */
export const DEFAULT_KEY_NAME = 'Claude';

export const hashAgentKey = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** Una llave nueva: la llave (se muestra una sola vez), su huella y la pista para reconocerla. */
export function newAgentKey() {
  const token = `${AGENT_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
  return { token, tokenHash: hashAgentKey(token), hint: token.slice(-4) };
}

/** La llave de `Authorization: Bearer …` (o null). */
export function bearerToken(header: string | undefined): string | null {
  return header?.match(/^Bearer\s+(\S+)\s*$/i)?.[1] ?? null;
}

/** Nombre corto y limpio; vacío → «Claude». */
export function cleanKeyName(name: string | undefined): string {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return clean || DEFAULT_KEY_NAME;
}
