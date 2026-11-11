import { theme, type ThemeConfig } from "antd";
import type { FfThemeMode } from "./useFfTheme";

/** Tema «Ciclovía» de Ant Design para FerFit: azul de señal para la acción. Mismos colores de ferfit.css. */
const shared: ThemeConfig["token"] = {
  borderRadius: 14,
  borderRadiusLG: 18,
  fontFamily: "'Barlow', system-ui, sans-serif",
  fontSize: 15,
  controlHeight: 42,
  controlHeightLG: 50,
};

const light: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    ...shared,
    colorPrimary: "#1D5BD8",
    colorSuccess: "#1D5BD8",
    colorWarning: "#B98200",
    colorError: "#B42318",
    colorLink: "#1A4FBB",
    colorBgLayout: "#F3F5F8",
    colorBgContainer: "#FFFFFF",
    colorBgElevated: "#FFFFFF",
    colorBorder: "#D7DDE6",
    colorBorderSecondary: "#E3E8EF",
    colorText: "#121826",
    colorTextSecondary: "#5A6577",
    colorTextTertiary: "#6F7A8C",
    colorTextPlaceholder: "#66717F",
    boxShadow: "0 10px 30px -12px rgba(18, 24, 38, 0.25)",
  },
  components: {
    Button: { fontWeight: 600, primaryShadow: "none" },
    Segmented: { itemSelectedBg: "#FFFFFF", trackBg: "#E7EBF1" },
    Drawer: { colorBgElevated: "#FAFBFD" },
    Modal: { contentBg: "#FFFFFF", headerBg: "#FFFFFF", footerBg: "transparent" },
    Input: { colorBgContainer: "#FFFFFF", activeBorderColor: "#1D5BD8", hoverBorderColor: "#8792A4" },
    InputNumber: { colorBgContainer: "#FFFFFF", activeBorderColor: "#1D5BD8", hoverBorderColor: "#8792A4" },
    Select: { colorBgContainer: "#FFFFFF" },
  },
};

const dark: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    ...shared,
    colorPrimary: "#7AA7FF",
    colorSuccess: "#7AA7FF",
    colorWarning: "#F5C443",
    colorError: "#F08080",
    colorLink: "#9CBEFF",
    colorBgLayout: "#0C1018",
    colorBgContainer: "#141A25",
    colorBgElevated: "#1B2331",
    colorBorder: "#2B3548",
    colorBorderSecondary: "#222B3B",
    colorText: "#EEF2F8",
    colorTextSecondary: "#94A0B4",
    colorTextTertiary: "#7D899D",
    colorTextPlaceholder: "#7D899D",
    boxShadow: "0 12px 34px -12px rgba(0, 0, 0, 0.6)",
  },
  components: {
    Button: { fontWeight: 600, primaryShadow: "none", primaryColor: "#08122A" },
    Segmented: { itemSelectedBg: "#263044", trackBg: "#141A25" },
    Drawer: { colorBgElevated: "#111722" },
    Modal: { contentBg: "#141A25", headerBg: "#141A25", footerBg: "transparent" },
    Input: { colorBgContainer: "#141A25", activeBorderColor: "#7AA7FF", hoverBorderColor: "#66728A" },
    InputNumber: { colorBgContainer: "#141A25", activeBorderColor: "#7AA7FF", hoverBorderColor: "#66728A" },
    Select: { colorBgContainer: "#141A25" },
  },
};

export function cicloviaThemeFor(mode: FfThemeMode): ThemeConfig {
  return mode === "dark" ? dark : light;
}
