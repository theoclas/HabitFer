/*
 * Videos de YouTube para FerFit: leer un link (cualquiera de sus formas) y preguntarle a YouTube si el video existe y
 * deja verse dentro de otras páginas (oEmbed). No se baja ni se guarda ningún video: la app usa el reproductor
 * oficial de YouTube en su modo de privacidad.
 */

const ID = /^[A-Za-z0-9_-]{11}$/;

/** «90», «1m30s», «1h2m3s» → segundos (hasta un día). */
function parseStart(t: string | null): number {
  if (!t) return 0;
  if (/^\d+s?$/.test(t)) return Math.min(parseInt(t, 10), 86_400);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m || !t) return 0;
  return Math.min(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0), 86_400);
}

/** El id de un video de YouTube y desde qué segundo empieza, o null si el link no es de un video. */
export function parseYouTube(input: string): { id: string; start: number } | null {
  const text = input.trim();
  if (ID.test(text)) return { id: text, start: 0 };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname)?.[1] ?? null;
  }
  if (!id || !ID.test(id)) return null;
  const hash = url.hash.startsWith('#t=') ? url.hash.slice(3) : null;
  return { id, start: parseStart(url.searchParams.get('t') ?? url.searchParams.get('start') ?? hash) };
}

export type OEmbed = { ok: true; title: string; channel: string } | { ok: false; reason: 'blocked' | 'missing' | 'offline' };

/** Le pregunta a YouTube por el video: título y canal, o por qué no se puede ver dentro de la app. */
export async function oembed(id: string, fetcher: typeof fetch = fetch): Promise<OEmbed> {
  try {
    const watch = `https://www.youtube.com/watch?v=${id}`;
    const res = await fetcher(`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`, {
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'blocked' };
    if (!res.ok) return { ok: false, reason: 'missing' };
    const j = (await res.json()) as { title?: unknown; author_name?: unknown };
    return {
      ok: true,
      title: typeof j.title === 'string' ? j.title.slice(0, 200) : '',
      channel: typeof j.author_name === 'string' ? j.author_name.slice(0, 120) : '',
    };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}
