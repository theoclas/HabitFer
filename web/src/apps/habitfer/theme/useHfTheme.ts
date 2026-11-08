import { useCallback, useEffect, useState } from "react";

export type HfThemePref = "night" | "day" | "auto";
export type HfThemeMode = "night" | "day";

const KEY = "hf_theme";
const THEME_COLOR: Record<HfThemeMode, string> = { night: "#0B0908", day: "#F6F2EE" };

function readPref(): HfThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "day" || v === "auto" || v === "night" ? v : "night";
  } catch {
    return "night";
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

/**
 * Tema de HabitFer: noche (por defecto), dia o automatico segun el telefono.
 * Mientras HabitFer esta abierto marca <html data-hf-theme> y ajusta el color de la barra del navegador.
 */
export function useHfTheme() {
  const [pref, setPrefState] = useState<HfThemePref>(readPref);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const mode: HfThemeMode = pref === "auto" ? (systemDark ? "night" : "day") : pref;

  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousMeta = meta?.content;
    root.dataset.hfTheme = mode;
    if (meta) meta.content = THEME_COLOR[mode];
    return () => {
      delete root.dataset.hfTheme;
      if (meta && previousMeta) meta.content = previousMeta;
    };
  }, [mode]);

  const setPref = useCallback((p: HfThemePref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* sin almacenamiento: vale para esta visita */
    }
    setPrefState(p);
  }, []);

  return { pref, mode, setPref };
}
