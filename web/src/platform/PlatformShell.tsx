import { Layout } from "antd";
import { Outlet } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import { RemindersBell } from "../features/reminders/RemindersBell";
import { AppSwitcher } from "./AppSwitcher";

const { Content, Header } = Layout;

type Props = {
  title?: string;
  showHeader?: boolean;
};

export function PlatformShell({ title, showHeader = true }: Props) {
  const isMobile = useIsMobile();

  return (
    <Layout style={{ minHeight: "100dvh", background: "#0a0a0f" }}>
      {showHeader && !isMobile && (
        <Header
          style={{
            background: "#0a0a0f",
            borderBottom: "1px solid #1e1e2a",
            padding: "0 40px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>{title ?? ""}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AppSwitcher />
            <RemindersBell />
          </div>
        </Header>
      )}
      {showHeader && isMobile && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: "1px solid #1e1e2a",
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "#0a0a0f",
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700 }}>{title ?? ""}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AppSwitcher />
            <RemindersBell />
          </div>
        </div>
      )}
      <Content
        style={{
          padding: isMobile ? "12px 16px 100px" : "32px 40px 40px",
          maxWidth: isMobile ? "100%" : 1400,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Outlet />
      </Content>
    </Layout>
  );
}
