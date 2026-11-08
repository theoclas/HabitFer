import { theme, type ThemeConfig } from "antd";
import type { NfThemeMode } from "./useNfTheme";

/**
 * Tema «Plaza» de Ant Design para NutriFer: papel con un dejo verde, aguacate para la acción.
 * Los colores salen de los mismos tokens de nutrifer.css.
 */
const shared: ThemeConfig["token"] = {
  borderRadius: 14,
  borderRadiusLG: 18,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  controlHeight: 42,
  controlHeightLG: 50,
};

const light: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    ...shared,
    colorPrimary: "#2B7A4A",
    colorSuccess: "#2B7A4A",
    colorWarning: "#B7791F",
    colorError: "#B42318",
    colorLink: "#2B7A4A",
    colorBgLayout: "#F3F6F1",
    colorBgContainer: "#FFFFFF",
    colorBgElevated: "#FFFFFF",
    colorBorder: "#D9E2D5",
    colorBorderSecondary: "#E5ECE2",
    colorText: "#142019",
    colorTextSecondary: "#5B6A61",
    colorTextTertiary: "#7A887F",
    // Los textos de ayuda de los campos se leen (4,5 a 1 sobre el papel).
    colorTextPlaceholder: "#6B7A70",
    boxShadow: "0 10px 30px -12px rgba(20, 32, 25, 0.25)",
  },
  components: {
    Button: { fontWeight: 600, primaryShadow: "none" },
    Segmented: { itemSelectedBg: "#FFFFFF", trackBg: "#E8EEE5" },
    Drawer: { colorBgElevated: "#FBFCFA" },
    // El tema de la plataforma pinta los diálogos y los campos de oscuro e índigo: aquí van con el papel de NutriFer.
    Modal: { contentBg: "#FFFFFF", headerBg: "#FFFFFF", footerBg: "transparent" },
    Input: { colorBgContainer: "#FFFFFF", activeBorderColor: "#2B7A4A", hoverBorderColor: "#8A978E" },
    Select: { colorBgContainer: "#FFFFFF" },
  },
};

const dark: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    ...shared,
    colorPrimary: "#5DBE85",
    colorSuccess: "#5DBE85",
    colorWarning: "#F0C64A",
    colorError: "#F08080",
    colorLink: "#7FD3A2",
    colorBgLayout: "#0D1310",
    colorBgContainer: "#151E19",
    colorBgElevated: "#1B2620",
    colorBorder: "#2C3A32",
    colorBorderSecondary: "#223029",
    colorText: "#EDF3EE",
    colorTextSecondary: "#97A69C",
    colorTextTertiary: "#7C8B81",
    colorTextPlaceholder: "#7C8B81",
    boxShadow: "0 12px 34px -12px rgba(0, 0, 0, 0.6)",
  },
  components: {
    Button: { fontWeight: 600, primaryShadow: "none", primaryColor: "#08170E" },
    Segmented: { itemSelectedBg: "#26352C", trackBg: "#151E19" },
    Drawer: { colorBgElevated: "#121A16" },
    Modal: { contentBg: "#151E19", headerBg: "#151E19", footerBg: "transparent" },
    Input: { colorBgContainer: "#151E19", activeBorderColor: "#5DBE85", hoverBorderColor: "#66756B" },
    Select: { colorBgContainer: "#151E19" },
  },
};

export function plazaThemeFor(mode: NfThemeMode): ThemeConfig {
  return mode === "dark" ? dark : light;
}
