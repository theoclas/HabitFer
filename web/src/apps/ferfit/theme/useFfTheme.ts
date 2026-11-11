import { useCallback, useEffect, useState } from "react";

export type FfThemePref = "auto" | "light" | "dark";
export type FfThemeMode = "light" | "dark";

const KEY = "fit_theme";
const THEME_COLOR: Record<FfThemeMode, string> = { light: "#F3F5F8", dark: "#0C1018" };

function readPref(): FfThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "auto" ? v : "auto";
  } catch {
    return "auto";
  }
}

const systemPrefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

/** Tema de FerFit: claro, oscuro o el del teléfono (por defecto). Ajusta también el color de la barra del navegador. */
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

  // En <html> para que las hojas y menús que se abren encima usen los mismos colores.
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    root.dataset.fitTheme = mode;
    root.style.colorScheme = mode;
    if (meta) meta.content = THEME_COLOR[mode];
    return () => {
      delete root.dataset.fitTheme;
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
