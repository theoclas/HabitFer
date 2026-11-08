import { useCallback, useEffect, useState } from "react";

export type NfThemePref = "auto" | "light" | "dark";
export type NfThemeMode = "light" | "dark";

const KEY = "nf_theme";
const THEME_COLOR: Record<NfThemeMode, string> = { light: "#F3F6F1", dark: "#0D1310" };

function readPref(): NfThemePref {
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

/** Tema de NutriFer: claro, oscuro o el del teléfono (por defecto). Ajusta el color de la barra del navegador. */
export function useNfTheme() {
  const [pref, setPrefState] = useState<NfThemePref>(readPref);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const mode: NfThemeMode = pref === "auto" ? (systemDark ? "dark" : "light") : pref;

  // En <html> (no solo en la página) para que las hojas y menús que se abren encima usen los mismos colores.
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    root.dataset.nfTheme = mode;
    root.style.colorScheme = mode;
    if (meta) meta.content = THEME_COLOR[mode];
    return () => {
      delete root.dataset.nfTheme;
      root.style.colorScheme = "";
      if (meta && previous) meta.content = previous;
    };
  }, [mode]);

  const setPref = useCallback((p: NfThemePref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* sin almacenamiento: vale para esta visita */
    }
    setPrefState(p);
  }, []);

  return { pref, mode, setPref };
}
