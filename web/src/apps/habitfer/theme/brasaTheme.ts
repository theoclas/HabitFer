import { theme, type ThemeConfig } from "antd";
import type { HfThemeMode } from "./useHfTheme";

/** Tema Brasa de Ant Design: solo se aplica dentro de HabitFer (ProyecFer y Fernance siguen igual). */
export const brasaTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#FF7A1A",
    colorInfo: "#4FD1E8",
    colorSuccess: "#5BD98A",
    colorWarning: "#F5B841",
    colorError: "#FF6B6B",
    colorLink: "#FF9A4D",
    colorBgLayout: "#0B0908",
    colorBgContainer: "#171311",
    colorBgElevated: "#1D1815",
    colorBorder: "rgba(255, 236, 222, 0.11)",
    colorBorderSecondary: "rgba(255, 236, 222, 0.07)",
    colorText: "#F6EEE7",
    colorTextSecondary: "#9C8D82",
    colorTextTertiary: "#7A6C62",
    colorTextQuaternary: "#5C5049",
    borderRadius: 14,
    borderRadiusLG: 18,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSizeHeading1: 34,
    fontSizeHeading2: 28,
    controlHeight: 40,
    controlHeightLG: 48,
    boxShadow: "0 6px 28px rgba(0, 0, 0, 0.45)",
    boxShadowSecondary: "0 2px 14px rgba(0, 0, 0, 0.35)",
  },
  components: {
    Button: {
      primaryColor: "#1A0C04",
      primaryShadow: "0 6px 18px -6px rgba(255, 122, 26, 0.55)",
      fontWeight: 600,
    },
    Card: { colorBgContainer: "#171311", paddingLG: 20 },
    Drawer: { colorBgElevated: "#171311" },
    Modal: { contentBg: "#1D1815", headerBg: "#1D1815" },
    Input: {
      colorBgContainer: "rgba(255, 236, 222, 0.04)",
      activeBorderColor: "#FF7A1A",
      hoverBorderColor: "rgba(255, 236, 222, 0.2)",
    },
    Select: { colorBgContainer: "rgba(255, 236, 222, 0.04)" },
    Segmented: { itemSelectedBg: "rgba(255, 122, 26, 0.22)", trackBg: "rgba(255, 236, 222, 0.05)" },
    Tag: { defaultBg: "rgba(255, 236, 222, 0.06)", defaultColor: "#D9CCC2" },
  },
};

/** Modo dia: hueso calido, la misma brasa un poco mas profunda para que lea sobre fondo claro. */
export const brasaDayTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#E8620C",
    colorInfo: "#0E9AB5",
    colorSuccess: "#15803D",
    colorWarning: "#B7791F",
    colorError: "#D64545",
    colorLink: "#C2410C",
    colorBgLayout: "#F6F2EE",
    colorBgContainer: "#FFFFFF",
    colorBgElevated: "#FFFFFF",
    colorBorder: "rgba(45, 25, 12, 0.14)",
    colorBorderSecondary: "rgba(45, 25, 12, 0.08)",
    colorText: "#1D1612",
    colorTextSecondary: "#6A5B50",
    colorTextTertiary: "#8A7B70",
    colorTextQuaternary: "#A99B90",
    borderRadius: 14,
    borderRadiusLG: 18,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSizeHeading1: 34,
    fontSizeHeading2: 28,
    controlHeight: 40,
    controlHeightLG: 48,
    boxShadow: "0 8px 28px rgba(60, 30, 10, 0.12)",
    boxShadowSecondary: "0 2px 12px rgba(60, 30, 10, 0.08)",
  },
  components: {
    Button: {
      primaryColor: "#1A0C04",
      primaryShadow: "0 6px 16px -6px rgba(232, 98, 12, 0.45)",
      fontWeight: 600,
    },
    Segmented: { itemSelectedBg: "#FFFFFF", trackBg: "rgba(45, 25, 12, 0.06)" },
    Tag: { defaultBg: "rgba(45, 25, 12, 0.05)", defaultColor: "#4A3C33" },
  },
};

export function brasaThemeFor(mode: HfThemeMode): ThemeConfig {
  return mode === "day" ? brasaDayTheme : brasaTheme;
}
