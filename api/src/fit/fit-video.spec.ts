import { READY_ROUTINES } from './data/routines';
import { EXERCISE_VIDEOS, ROUTINE_VIDEOS } from './data/videos';
import { EXERCISE_BY_KEY, READY_BY_KEY, TOPIC_LABELS } from './library';
import { oembed, parseYouTube } from './youtube';

describe('links de YouTube', () => {
  it('lee todas las formas de un link y el minuto de inicio', () => {
    expect(parseYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ id: 'dQw4w9WgXcQ', start: 0 });
    expect(parseYouTube('youtube.com/watch?v=dQw4w9WgXcQ&t=90s')).toEqual({ id: 'dQw4w9WgXcQ', start: 90 });
    expect(parseYouTube('https://youtu.be/dQw4w9WgXcQ?t=1m30s')).toEqual({ id: 'dQw4w9WgXcQ', start: 90 });
    expect(parseYouTube('https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share')).toEqual({ id: 'dQw4w9WgXcQ', start: 0 });
    expect(parseYouTube('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({ id: 'dQw4w9WgXcQ', start: 0 });
    expect(parseYouTube('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=45')).toEqual({ id: 'dQw4w9WgXcQ', start: 45 });
    expect(parseYouTube('  dQw4w9WgXcQ  ')).toEqual({ id: 'dQw4w9WgXcQ', start: 0 });
  });

  it('lo que no es un video de YouTube no pasa', () => {
    expect(parseYouTube('https://vimeo.com/123456')).toBeNull();
    expect(parseYouTube('https://www.youtube.com/@canal')).toBeNull();
    expect(parseYouTube('https://www.youtube.com/watch?v=corto')).toBeNull();
    expect(parseYouTube('hola')).toBeNull();
  });

  it('YouTube dice si el video existe y deja verse dentro de otras páginas', async () => {
    const answer = (status: number, body: unknown = {}) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    await expect(oembed('dQw4w9WgXcQ', answer(200, { title: 'Sentadilla', author_name: 'Canal' }))).resolves.toEqual({ ok: true, title: 'Sentadilla', channel: 'Canal' });
    await expect(oembed('dQw4w9WgXcQ', answer(401))).resolves.toEqual({ ok: false, reason: 'blocked' });
    await expect(oembed('dQw4w9WgXcQ', answer(404))).resolves.toEqual({ ok: false, reason: 'missing' });
    const down = (async () => {
      throw new Error('sin internet');
    }) as unknown as typeof fetch;
    await expect(oembed('dQw4w9WgXcQ', down)).resolves.toEqual({ ok: false, reason: 'offline' });
  });
});

describe('enfoques y videos de la biblioteca', () => {
  it('cada rutina lista tiene enfoques conocidos', () => {
    for (const r of READY_ROUTINES) {
      expect([r.key, (r.topics ?? []).length > 0]).toEqual([r.key, true]);
      for (const t of r.topics ?? []) expect([r.key, t in TOPIC_LABELS]).toEqual([r.key, true]);
    }
    for (const t of Object.keys(TOPIC_LABELS)) expect([t, READY_ROUTINES.some((r) => r.topics?.includes(t as never))]).toEqual([t, true]);
  });

  it('los videos escogidos son de ejercicios y rutinas que existen, con un id válido', () => {
    for (const [key, v] of Object.entries(EXERCISE_VIDEOS)) {
      expect([key, EXERCISE_BY_KEY.has(key), /^[A-Za-z0-9_-]{11}$/.test(v.id)]).toEqual([key, true, true]);
    }
    for (const [key, v] of Object.entries(ROUTINE_VIDEOS)) {
      expect([key, READY_BY_KEY.has(key), /^[A-Za-z0-9_-]{11}$/.test(v.id)]).toEqual([key, true, true]);
    }
  });
});
