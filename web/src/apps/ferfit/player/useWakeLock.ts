import { useCallback, useEffect, useRef, useState } from "react";

/** on: la pantalla no se apaga; off: aún no; unsupported: el navegador no lo permite; denied: no se pudo esta vez. */
export type WakeState = "off" | "on" | "unsupported" | "denied";

const supported = () => typeof navigator !== "undefined" && "wakeLock" in navigator;

/**
 * Que la pantalla no se apague mientras se entrena. Se vuelve a pedir al volver a la app (el navegador la suelta
 * al salir) y en cada toque si se había perdido (Safari a veces solo la da dentro de un toque).
 */
export function useWakeLock(active: boolean) {
  const [state, setState] = useState<WakeState>(() => (supported() ? "off" : "unsupported"));
  const lock = useRef<WakeLockSentinel | null>(null);
  const pending = useRef(false);
  const wanted = useRef(active);
  wanted.current = active;

  /** `force`: pedirla ya, dentro del toque que empieza el entrenamiento (antes de que la pantalla cambie). */
  const request = useCallback(async (force = false) => {
    if (!supported()) {
      setState("unsupported");
      return;
    }
    if ((!wanted.current && !force) || pending.current || (lock.current && !lock.current.released)) return;
    pending.current = true;
    try {
      const l = await navigator.wakeLock.request("screen");
      if (!wanted.current) {
        void l.release().catch(() => undefined);
        return;
      }
      lock.current = l;
      setState("on");
      l.addEventListener("release", () => {
        if (lock.current === l) {
          lock.current = null;
          setState("off");
        }
      });
    } catch {
      setState("denied");
    } finally {
      pending.current = false;
    }
  }, []);

  const release = useCallback(() => {
    const l = lock.current;
    lock.current = null;
    if (l && !l.released) void l.release().catch(() => undefined);
    setState((s) => (s === "unsupported" ? s : "off"));
  }, []);

  useEffect(() => {
    if (!active) {
      release();
      return undefined;
    }
    void request();
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active, request, release]);

  useEffect(() => release, [release]);

  return { state, request };
}
