/*
 * Service worker de HabitFer.
 * scripts/build-sw.mjs genera dist/sw.js a partir de esta plantilla al compilar:
 * reemplaza la version y la lista de archivos a guardar en cache.
 *
 * - Abre la app sin conexion (la pantalla guardada y los ultimos datos de la API).
 * - Muestra las notificaciones push y resuelve el boton "Hecho" sin abrir la app.
 */
/* eslint-disable no-restricted-globals */

const VERSION = "__HF_VERSION__";
const PRECACHE = __HF_PRECACHE__;
const STATIC_CACHE = `hf-static-${VERSION}`;
const API_CACHE = "hf-api";
const FONT_CACHE = "hf-fonts";
const SHELL_URL = "/index.html";
const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("hf-static-") && k !== STATIC_CACHE).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => undefined);
      }
      await self.clients.claim();
    })(),
  );
});

/* ---------- Cache ---------- */

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

/** Red primero (para tener datos frescos) y, sin señal, lo ultimo que se vio. */
async function networkFirst(request, cacheName, ms) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([fetch(request), timeout(ms)]);
    if (response && response.ok) cache.put(request, response.clone()).catch(() => undefined);
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") cache.put(request, response.clone()).catch(() => undefined);
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

/** La app es una sola pagina: sin red, cualquier ruta abre la pantalla guardada. */
async function navigation(event) {
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    if (preload) return preload;
    return await Promise.race([fetch(event.request), timeout(4000)]);
  } catch {
    const cached = await caches.match(SHELL_URL);
    return cached || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/")) {
      // Sesion y push siempre van a la red.
      if (url.pathname.startsWith("/api/auth/") || url.pathname.startsWith("/api/push/")) return;
      event.respondWith(networkFirst(request, API_CACHE, 8000));
      return;
    }
    if (request.mode === "navigate") {
      event.respondWith(navigation(event));
      return;
    }
    if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/") || PRECACHE.includes(url.pathname)) {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
  }
});

/* ---------- Notificaciones ---------- */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "HabitFer", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "HabitFer";
  const options = {
    body: payload.body || "",
    icon: ICON,
    badge: BADGE,
    vibrate: [60, 40, 60],
    data: { url: payload.url || "/app/habitfer", ...(payload.data || {}) },
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : [],
  };
  if (payload.tag) {
    options.tag = payload.tag;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

async function openApp(url) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if (new URL(client.url).origin === self.location.origin) {
      await client.focus();
      if ("navigate" in client) await client.navigate(url).catch(() => undefined);
      return;
    }
  }
  await self.clients.openWindow(url);
}

async function tellWindows(message) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  windows.forEach((client) => client.postMessage(message));
}

/** Boton "Hecho": marca el habito (o la tarea) con el token de un solo uso del push. */
async function markDone(data) {
  try {
    const res = await fetch("/api/push/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: data.token }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      await self.registration.showNotification("No se pudo marcar", {
        body: json.message || "Ábrelo en HabitFer para marcarlo.",
        icon: ICON,
        badge: BADGE,
        tag: "hf-action",
        data: { url: "/app/habitfer" },
      });
      return;
    }
    await tellWindows({ type: "hf-habits-changed" });

    if (json.kind === "habit" && json.achievement) {
      await self.registration.showNotification("🏆 Logro desbloqueado", {
        body: `${json.title} · ${json.achievement.days} días · «${json.achievement.label}»`,
        icon: ICON,
        badge: BADGE,
        tag: "hf-achievement",
        data: { url: "/app/habitfer/logros" },
      });
      return;
    }

    const body = json.kind === "habit" ? (json.streak > 1 ? `Racha de ${json.streak} días 🔥` : "¡Bien hecho!") : "Tarea completada.";
    await self.registration.showNotification(`✓ ${json.title}`, {
      body,
      icon: ICON,
      badge: BADGE,
      tag: "hf-done",
      silent: true,
      data: { url: "/app/habitfer" },
    });
    // La confirmacion se cierra sola a los pocos segundos.
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const shown = await self.registration.getNotifications({ tag: "hf-done" });
    shown.forEach((n) => n.close());
  } catch {
    await self.registration.showNotification("Sin conexión", {
      body: "No pude marcarlo. Ábrelo en HabitFer cuando tengas señal.",
      icon: ICON,
      badge: BADGE,
      tag: "hf-action",
      data: { url: "/app/habitfer" },
    });
  }
}

self.addEventListener("notificationclick", (event) => {
  const { notification } = event;
  const data = notification.data || {};
  notification.close();
  if (event.action === "done" && data.token) {
    event.waitUntil(markDone(data));
    return;
  }
  event.waitUntil(openApp(data.url || "/app/habitfer"));
});

/** Si el servicio de push renueva la suscripcion, se reenvia al servidor (si la sesion sigue viva). */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
      if (!key) return;
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
    })().catch(() => undefined),
  );
});
