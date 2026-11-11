import { useEffect, useMemo, useState } from "react";
import { cachedLibrary, fetchLibrary } from "./api";
import type { Exercise, Library } from "./types";

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
