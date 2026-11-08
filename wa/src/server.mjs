// Servicio de WhatsApp de HabitFer: un celular vinculado (igual que WhatsApp Web) que envía los avisos.
//
// API interna (solo la red de Docker; cada pedido lleva el encabezado x-wa-token = WA_TOKEN):
//   GET  /status          → { state, me, qr, updatedAt, error }
//   POST /start           → vuelve a pedir un QR si estaba en pausa
//   POST /check  {to}     → { exists } (si ese número tiene WhatsApp)
//   POST /send   {to,text}→ { ok, id } | { ok: false, error }
//   POST /logout          → desvincula el celular y deja listo un QR nuevo
// Estados: starting | qr | connecting | open | idle (sin vincular y sin pedir QR) | error.
//
// WA_FAKE=open|qr: modo de prueba sin WhatsApp (para probar la app en local).
// En ese modo GET /fake/sent lista lo "enviado" y POST /fake/scan simula escanear el QR.
import { timingSafeEqual } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import pino from 'pino';
import QRCode from 'qrcode';
import { jidToPhone, normalizeDigits } from './phone.mjs';

const PORT = Number(process.env.PORT) || 4010;
const TOKEN = process.env.WA_TOKEN || '';
const AUTH_DIR = process.env.WA_AUTH_DIR || '/data/auth';
const FAKE = process.env.WA_FAKE || '';
/** Pausa entre mensajes: WhatsApp desconfía de las ráfagas. */
const GAP_MS = Number(process.env.WA_GAP_MS ?? 1500);
/** Sin vincular, después de estas vueltas de QR sin escanear se pausa hasta que alguien pida otro. */
const MAX_QR_ROUNDS = 3;

const logger = pino({ level: process.env.WA_LOG_LEVEL || 'warn' });
const status = { state: 'starting', me: null, qr: null, updatedAt: new Date().toISOString(), error: null };
const set = (patch) => Object.assign(status, patch, { updatedAt: new Date().toISOString() });

let sock = null;
let starting = false;
let retries = 0;
let qrRounds = 0;
const jidCache = new Map();
const fakeSent = [];

/* ---------------- Conexión ---------------- */

async function start() {
  if (FAKE) return startFake();
  if (starting || sock) return;
  starting = true;
  try {
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default?.default ?? baileys.default ?? baileys.makeWASocket;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = baileys;

    await mkdir(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const linked = Boolean(state.creds?.me);
    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch {
      // Sin internet hacia GitHub: se usa la versión que trae la librería.
    }

    const s = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger,
      browser: Browsers.ubuntu('HabitFer'),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    sock = s;
    set({ state: linked ? 'connecting' : 'starting', error: null });
    s.ev.on('creds.update', saveCreds);
    s.ev.on('connection.update', async (u) => {
      if (u.qr) {
        set({ state: 'qr', qr: await QRCode.toDataURL(u.qr, { margin: 1, width: 360 }), error: null });
      }
      if (u.connection === 'open') {
        retries = 0;
        qrRounds = 0;
        set({ state: 'open', qr: null, me: jidToPhone(s.user?.id), error: null });
        console.log(`WhatsApp conectado (${status.me})`);
      }
      if (u.connection === 'close') {
        if (sock === s) sock = null;
        const code = u.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.log('El celular se desvinculó: se borra la sesión');
          await rm(AUTH_DIR, { recursive: true, force: true });
          jidCache.clear();
          set({ state: 'idle', me: null, qr: null, error: 'Se desvinculó el celular.' });
          return;
        }
        if (!s.authState.creds?.me) {
          // Nadie escaneó el QR: unas vueltas más y luego en pausa.
          qrRounds++;
          if (qrRounds >= MAX_QR_ROUNDS) {
            set({ state: 'idle', qr: null, error: null });
            return;
          }
        }
        retries++;
        const wait = Math.min(60_000, 1500 * retries);
        set({ state: 'connecting', qr: null, error: code ? `Se cerró la conexión (${code}); reintentando.` : null });
        setTimeout(() => void start(), wait);
      }
    });
  } catch (err) {
    sock = null;
    set({ state: 'error', error: String(err?.message || err) });
    console.error('No se pudo iniciar WhatsApp:', err);
    setTimeout(() => void start(), 30_000);
  } finally {
    starting = false;
  }
}

async function logout() {
  if (FAKE) {
    set({ state: 'idle', me: null, qr: null });
    return;
  }
  if (sock) {
    // El evento de cierre (loggedOut) borra la sesión.
    await sock.logout().catch(() => undefined);
  } else {
    await rm(AUTH_DIR, { recursive: true, force: true });
    set({ state: 'idle', me: null, qr: null, error: null });
  }
}

/** Vuelve a pedir QR (o a conectar) si estaba en pausa. */
function wake() {
  if (['idle', 'error'].includes(status.state) && !sock) {
    qrRounds = 0;
    retries = 0;
    set({ state: 'starting', error: null });
    void start();
  }
}

/* ---------------- Envío ---------------- */

let queue = Promise.resolve();

async function jidFor(digits) {
  if (jidCache.has(digits)) return jidCache.get(digits);
  const [hit] = (await sock.onWhatsApp(digits)) ?? [];
  const jid = hit?.exists ? hit.jid : null;
  if (jid) jidCache.set(digits, jid);
  return jid;
}

async function check(to) {
  const digits = normalizeDigits(to);
  if (!digits) return { ok: false, status: 400, error: 'Número inválido.' };
  if (FAKE) return { ok: true, exists: !digits.endsWith('000') };
  if (!sock || status.state !== 'open') return { ok: false, status: 503, error: 'El celular que envía no está conectado.' };
  return { ok: true, exists: Boolean(await jidFor(digits)) };
}

function send(to, text) {
  const job = queue.then(async () => {
    const digits = normalizeDigits(to);
    if (!digits) return { ok: false, status: 400, error: 'Número inválido.' };
    if (typeof text !== 'string' || !text.trim()) return { ok: false, status: 400, error: 'Mensaje vacío.' };
    const body = text.slice(0, 4000);
    if (FAKE) {
      if (status.state !== 'open') return { ok: false, status: 503, error: 'El celular que envía no está conectado.' };
      fakeSent.push({ to: digits, text: body, at: new Date().toISOString() });
      return { ok: true, id: `fake-${fakeSent.length}` };
    }
    if (!sock || status.state !== 'open') return { ok: false, status: 503, error: 'El celular que envía no está conectado.' };
    try {
      const jid = await jidFor(digits);
      if (!jid) return { ok: false, status: 400, error: 'Ese número no tiene WhatsApp.' };
      const sent = await sock.sendMessage(jid, { text: body });
      await delay(GAP_MS);
      return { ok: true, id: sent?.key?.id ?? null };
    } catch (err) {
      console.error('No se pudo enviar:', err?.message || err);
      return { ok: false, status: 502, error: 'WhatsApp no aceptó el mensaje.' };
    }
  });
  queue = job.catch(() => undefined);
  return job;
}

/* ---------------- Modo de prueba ---------------- */

async function startFake() {
  if (FAKE === 'qr' && status.state !== 'open') {
    set({ state: 'qr', qr: await QRCode.toDataURL('habitfer-prueba-local', { margin: 1, width: 360 }), me: null });
  } else {
    set({ state: 'open', qr: null, me: '573000000000' });
  }
}

/* ---------------- HTTP ---------------- */

function sameToken(given) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw new Error('cuerpo muy grande');
  }
  return raw ? JSON.parse(raw) : {};
}

const server = createServer(async (req, res) => {
  const reply = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };
  if (!sameToken(req.headers['x-wa-token'])) return reply(401, { error: 'token' });
  const path = new URL(req.url ?? '/', 'http://wa').pathname;
  try {
    if (req.method === 'GET' && path === '/status') return reply(200, status);
    if (req.method === 'POST' && path === '/start') {
      wake();
      return reply(200, status);
    }
    if (req.method === 'POST' && path === '/check') {
      const r = await check((await readJson(req)).to);
      return reply(r.ok ? 200 : r.status, r);
    }
    if (req.method === 'POST' && path === '/send') {
      const { to, text } = await readJson(req);
      const r = await send(to, text);
      return reply(r.ok ? 200 : r.status, r);
    }
    if (req.method === 'POST' && path === '/logout') {
      await logout();
      return reply(200, status);
    }
    if (FAKE && req.method === 'GET' && path === '/fake/sent') return reply(200, fakeSent);
    if (FAKE && req.method === 'POST' && path === '/fake/scan') {
      set({ state: 'open', qr: null, me: '573000000000' });
      return reply(200, status);
    }
    return reply(404, { error: 'no existe' });
  } catch (err) {
    return reply(500, { error: String(err?.message || err) });
  }
});

if (!TOKEN) {
  // Sin token no se expone nada; el proceso queda vivo para que Docker no lo reinicie en bucle.
  console.error('Falta WA_TOKEN: el servicio de WhatsApp queda en pausa.');
  setInterval(() => undefined, 1 << 30);
} else {
  server.listen(PORT, () => console.log(`Servicio de WhatsApp en el puerto ${PORT}${FAKE ? ` (modo de prueba: ${FAKE})` : ''}`));
  void start();
}
