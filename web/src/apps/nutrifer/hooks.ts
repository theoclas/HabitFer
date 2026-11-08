import { message } from "antd";
import axios from "axios";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../habitfer/format";
import { fetchPhotoBlob, searchFoods } from "./api";
import type { FoodResult } from "./types";

/** Las fotos pendientes ya bajadas (la ruta pide la sesión: se bajan como blob una sola vez). */
const photoCache = new Map<string, Promise<string>>();

/** Dirección local (blob:) de una foto pendiente; null mientras baja o si falla. */
export function usePhotoUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!id) return;
    let alive = true;
    let job = photoCache.get(id);
    if (!job) {
      job = fetchPhotoBlob(id).then((blob) => URL.createObjectURL(blob));
      photoCache.set(id, job);
      job.catch(() => photoCache.delete(id));
    }
    job.then((u) => alive && setUrl(u)).catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

/** Olvida una foto que ya se borró (libera su blob). */
export function forgetPhoto(id: string) {
  const job = photoCache.get(id);
  photoCache.delete(id);
  void job?.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
}

/** Búsqueda mientras se escribe: espera un instante y cancela la anterior. null = buscando o sin texto. */
export function useFoodSearch(q: string): FoodResult[] | null {
  const [results, setResults] = useState<FoodResult[] | null>(null);
  useEffect(() => {
    const term = q.trim();
    setResults(null);
    if (!term) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      searchFoods(term, ctrl.signal)
        .then(setResults)
        .catch((err) => {
          if (!axios.isCancel(err)) message.error(apiErrorMessage(err, "No se pudo buscar"));
        });
    }, 160);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);
  return results;
}
