import { message } from "antd";
import axios from "axios";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../habitfer/format";
import { searchFoods } from "./api";
import type { FoodResult } from "./types";

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
