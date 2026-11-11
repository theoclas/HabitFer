import { useEffect, useMemo, useState } from "react";
import { cachedLibrary, fetchFitSettings, fetchLibrary, fetchMyVideos } from "./api";
import type { Exercise, FitSettings, Library, MyVideo, ReadyRoutine } from "./types";

/** Un dato compartido entre pantallas: se pide al abrir la primera y todas ven el mismo. */
function shared<T>(loader: () => Promise<T>) {
  let value: T | null = null;
  const subs = new Set<() => void>();
  const set = (v: T) => {
    value = v;
    subs.forEach((s) => s());
  };
  function use(): T | null {
    const [v, setV] = useState<T | null>(value);
    useEffect(() => {
      const on = () => setV(value);
      subs.add(on);
      loader()
        .then(set)
        .catch(() => undefined);
      return () => {
        subs.delete(on);
      };
    }, []);
    return v;
  }
  return { use, set, get: () => value };
}

/** Los ajustes de FerFit (la meta, el recordatorio y lo que hay en casa). */
export const fitSettings = shared<FitSettings>(fetchFitSettings);
/** Los videos de YouTube que la persona pegó. */
export const myVideos = shared<MyVideo[]>(fetchMyVideos);

/*
 * La biblioteca (ejercicios con su figura y rutinas listas) se pide una vez por visita. Mientras llega, se usa la
 * guardada en el teléfono, así la app pinta al instante.
 */
let current: Library | null = cachedLibrary();
let request: Promise<Library> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<Library> {
  if (!request) {
    request = fetchLibrary()
      .then((lib) => {
        current = lib;
        listeners.forEach((l) => l());
        return lib;
      })
      .catch((err: unknown) => {
        request = null;
        throw err;
      });
  }
  return request;
}

/** Una rutina lista o una sesión de programa («programa--s1-2»), por su clave. */
export function findReady(lib: Library | null, key: string | undefined): ReadyRoutine | null {
  if (!lib || !key) return null;
  return lib.ready.find((r) => r.key === key) ?? (lib.programs ?? []).flatMap((p) => p.sessions.flat()).find((s) => s.key === key) ?? null;
}

/** La clave es de una sesión de programa y la biblioteca guardada aún no trae programas (llega enseguida). */
export const waitsForPrograms = (lib: Library | null, key: string | undefined) => !!key && key.includes("--s") && !!lib && !lib.programs;

export function useLibrary(): { lib: Library | null; error: boolean; byKey: Map<string, Exercise> } {
  const [lib, setLib] = useState<Library | null>(current);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onChange = () => setLib(current);
    listeners.add(onChange);
    load()
      .then(() => setError(false))
      .catch(() => setError(current === null));
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const byKey = useMemo(() => new Map((lib?.exercises ?? []).map((e) => [e.key, e])), [lib]);
  return { lib, error, byKey };
}
