import { theme, type ThemeConfig } from "antd";
import type { FfThemeMode } from "./useFfTheme";

/**
 * Tema «Tumbaga» de Ant Design para FerFinance: el oro precolombino para la acción, esmeralda para la plata
 * que entra y cobre para la que sale. Los colores salen de los mismos tokens de ferfinance.css.
 * Se pintan a propósito los diálogos, cajones y campos: el tema de la plataforma los trae oscuros e índigo.
 */
const shared: ThemeConfig["token"] = {
  borderRadius: 12,
  borderRadiusLG: 16,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  controlHeight: 42,
  controlHeightLG: 50,
};

const light: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    ...shared,
    colorPrimary: "#B8901C",
    colorLink: "#7E5F0E",
    colorInfo: "#0D6E4C",
    colorSuccess: "#0D6E4C",
    colorWarning: "#B7791F",
    colorError: "#B42318",
    colorBgLayout: "#EDF1EA",
    colorBgContainer: "#FAFCF8",
    colorBgElevated: "#FFFFFF",
    colorBorder: "#CFD9CB",
    colorBorderSecondary: "#DDE5D9",
    colorText: "#12201A",
    colorTextSecondary: "#5A6860",
    colorTextTertiary: "#6E7C74",
    colorTextPlaceholder: "#6B7A70",
    boxShadow: "0 10px 30px -12px rgba(18, 32, 26, 0.25)",
  },
  components: {
    Button: { fontWeight: 600, primaryShadow: "none", primaryColor: "#1B1505" },
    Segmented: { itemSelectedBg: "#FFFFFF", trackBg: "#E1E7DC" },
    Modal: { contentBg: "#FAFCF8", headerBg: "#FAFCF8", footerBg: "transparent" },
    Drawer: { colorBgElevated: "#FAFCF8" },
    Input: { colorBgContainer: "#FFFFFF", activeBorderColor: "#B8901C", hoverBorderColor: "#8A978E" },
    InputNumber: { colorBgContainer: "#FFFFFF", activeBorderColor: "#B8901C", hoverBorderColor: "#8A978E" },
    Select: { colorBgContainer: "#FFFFFF", optionSelectedBg: "#F2E8C6" },
    DatePicker: { colorBgContainer: "#FFFFFF", activeBorderColor: "#B8901C", hoverBorderColor: "#8A978E" },
  },
};

const dark: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    ...shared,
    colorPrimary: "#D4AF37",
    colorLink: "#E2C15A",
    colorInfo: "#4CC892",
    colorSuccess: "#4CC892",
    colorWarning: "#E2C15A",
    colorError: "#F08080",
    colorBgLayout: "#0A100D",
    colorBgContainer: "#111915",
    colorBgElevated: "#17211C",
    colorBorder: "#2A372F",
    colorBorderSecondary: "#1F2A24",
    colorText: "#EEF3EE",
    colorTextSecondary: "#92A098",
    colorTextTertiary: "#7A8880",
    colorTextPlaceholder: "#7A8880",
    boxShadow: "0 12px 34px -12px rgba(0, 0, 0, 0.6)",
  },
  components: {
    Button: { fontWeight: 600, primaryShadow: "none", primaryColor: "#1B1505" },
    Segmented: { itemSelectedBg: "#22302A", trackBg: "#111915" },
    Modal: { contentBg: "#111915", headerBg: "#111915", footerBg: "transparent" },
    Drawer: { colorBgElevated: "#111915" },
    Input: { colorBgContainer: "#0E1512", activeBorderColor: "#D4AF37", hoverBorderColor: "#5E6D64" },
    InputNumber: { colorBgContainer: "#0E1512", activeBorderColor: "#D4AF37", hoverBorderColor: "#5E6D64" },
    Select: { colorBgContainer: "#0E1512", optionSelectedBg: "#2B2613" },
    DatePicker: { colorBgContainer: "#0E1512", activeBorderColor: "#D4AF37", hoverBorderColor: "#5E6D64" },
  },
};

export function tumbagaThemeFor(mode: FfThemeMode): ThemeConfig {
  return mode === "dark" ? dark : light;
}
