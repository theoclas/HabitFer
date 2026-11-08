/** Suscripcion a notificaciones push en este dispositivo. */
import { fetchPushPublicKey, subscribePush, unsubscribePush } from "../../api/client";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export function pushSupported(): boolean {
  return window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** `ready` nunca resuelve si no hay service worker (p. ej. en desarrollo): se corta a los pocos segundos. */
async function registration(ms = 4000): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function pushState(iosNeedsInstall: boolean): Promise<PushState> {
  if (iosNeedsInstall) return "needs-install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = Notification.permission === "granted" ? await currentSubscription() : null;
  return sub ? "on" : "off";
}

async function sendToServer(sub: PushSubscription) {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("suscripcion incompleta");
  await subscribePush({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent.slice(0, 300),
  });
}

/** Pide permiso (debe llamarse desde un toque del usuario) y registra este dispositivo. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";
  const { publicKey } = await fetchPushPublicKey();
  if (!publicKey) throw new Error("El servidor todavía no tiene activadas las notificaciones.");
  const reg = await registration(8000);
  if (!reg) throw new Error("La app aún no terminó de instalarse; vuelve a intentarlo en unos segundos.");
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await sendToServer(sub);
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const sub = await currentSubscription();
  if (sub) {
    await unsubscribePush(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return "off";
}

/** Al abrir la app: si ya hay permiso y suscripcion, se reenvia al servidor (por si rotó o se cambio de usuario). */
export async function resyncPush() {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const sub = await currentSubscription();
    if (sub) await sendToServer(sub);
  } catch {
    /* se reintenta la proxima vez */
  }
}
