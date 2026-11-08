/** HabitFer como app instalable: service worker, aviso de instalacion e insignia del icono. */
import { useEffect, useState } from "react";
import { notifyHabitsChanged } from "./effects";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** Registra el service worker (solo en produccion y con https o localhost) y escucha sus avisos. */
export function setupPwa() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });

  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || !window.isSecureContext) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  // Tras un despliegue el service worker nuevo toma el control: se recarga una vez para usar la version nueva.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
  // El boton "Hecho" de una notificacion marco algo: las pantallas abiertas se refrescan.
  navigator.serviceWorker.addEventListener("message", (event) => {
    if ((event.data as { type?: string } | null)?.type === "hf-habits-changed") notifyHabitsChanged();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
      })
      .catch(() => undefined);
  });
}

/** Estado de instalacion para mostrar el boton o las instrucciones de iPhone. */
export function useInstallState() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const standalone = isStandalone();
  return {
    standalone,
    /** Android y escritorio: el navegador ofrece instalar. */
    canPrompt: !standalone && deferredPrompt !== null,
    /** iPhone: se instala a mano desde Compartir. */
    iosManual: !standalone && isIos() && window.isSecureContext,
    async promptInstall(): Promise<boolean> {
      if (!deferredPrompt) return false;
      const ev = deferredPrompt;
      deferredPrompt = null;
      emit();
      await ev.prompt();
      const choice = await ev.userChoice.catch(() => ({ outcome: "dismissed" as const }));
      return choice.outcome === "accepted";
    },
  };
}

/** Numero de habitos pendientes sobre el icono de la app (donde el sistema lo permite). */
export function setAppBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) void nav.setAppBadge?.(count)?.catch(() => undefined);
    else void nav.clearAppBadge?.()?.catch(() => undefined);
  } catch {
    /* sin insignia */
  }
}

/** Al cerrar sesion se borran los datos de la API guardados para usar sin conexion. */
export function clearOfflineData() {
  try {
    void caches?.delete("hf-api").catch(() => undefined);
  } catch {
    /* sin cache */
  }
}
