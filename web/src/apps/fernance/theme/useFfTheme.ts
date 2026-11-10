import { useCallback, useEffect, useState } from "react";

export type FfThemePref = "auto" | "light" | "dark";
export type FfThemeMode = "light" | "dark";

const KEY = "ff_theme";
const THEME_COLOR: Record<FfThemeMode, string> = { light: "#EDF1EA", dark: "#0A100D" };

function readPref(): FfThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "auto" ? v : "auto";
  } catch {
    return "auto";
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Tema de FerFinance: claro, oscuro o el del teléfono (por defecto). Ajusta el color de la barra del navegador. */
export function useFfTheme() {
  const [pref, setPrefState] = useState<FfThemePref>(readPref);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const mode: FfThemeMode = pref === "auto" ? (systemDark ? "dark" : "light") : pref;

  // En <html> (no solo en la página) para que los diálogos y menús que se abren encima usen los mismos colores.
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    root.dataset.ffTheme = mode;
    root.style.colorScheme = mode;
    if (meta) meta.content = THEME_COLOR[mode];
    return () => {
      delete root.dataset.ffTheme;
      root.style.colorScheme = "";
      if (meta && previous) meta.content = previous;
    };
  }, [mode]);

  const setPref = useCallback((p: FfThemePref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* sin almacenamiento: vale para esta visita */
    }
    setPrefState(p);
  }, []);

  return { pref, mode, setPref };
}
