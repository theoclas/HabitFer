import { theme, type ThemeConfig } from "antd";

export const habitFerTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#2dd4bf",
    colorInfo: "#6366f1",
    colorSuccess: "#34d399",
    colorWarning: "#fbbf24",
    colorError: "#f87171",
    colorBgLayout: "#08080d",
    colorBgContainer: "#12121a",
    colorBgElevated: "#16161f",
    colorBorder: "rgba(255, 255, 255, 0.08)",
    colorText: "#f1f5f9",
    colorTextSecondary: "#94a3b8",
    borderRadius: 14,
    borderRadiusLG: 18,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSizeHeading1: 32,
    fontSizeHeading2: 26,
    controlHeight: 40,
    controlHeightLG: 48,
    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.35)",
    boxShadowSecondary: "0 2px 12px rgba(0, 0, 0, 0.25)",
  },
  components: {
    Card: {
      colorBgContainer: "#12121a",
      paddingLG: 20,
    },
    Drawer: {
      colorBgElevated: "#12121a",
    },
    Modal: {
      contentBg: "#16161f",
      headerBg: "#16161f",
    },
    Button: {
      primaryShadow: "0 4px 14px rgba(45, 212, 191, 0.25)",
      fontWeight: 600,
    },
    Input: {
      colorBgContainer: "rgba(255, 255, 255, 0.04)",
      activeBorderColor: "#6366f1",
      hoverBorderColor: "rgba(255, 255, 255, 0.15)",
    },
    Select: {
      colorBgContainer: "rgba(255, 255, 255, 0.04)",
    },
    Segmented: {
      itemSelectedBg: "rgba(99, 102, 241, 0.25)",
      trackBg: "rgba(255, 255, 255, 0.04)",
    },
    Tag: {
      defaultBg: "rgba(255, 255, 255, 0.06)",
      defaultColor: "#cbd5e1",
    },
  },
};
