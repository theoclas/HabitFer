import { Layout } from "antd";
import {
  CalendarOutlined,
  CheckSquareOutlined,
  FireOutlined,
  LineChartOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ProfileModal } from "../../../components/ProfileModal";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { RemindersBell } from "../../../features/reminders/RemindersBell";
import { AppSwitcher } from "../../../platform/AppSwitcher";

const { Content, Sider, Header } = Layout;
const BASE = "/app/habitfer";

const navItems = [
  { key: BASE, icon: <CalendarOutlined />, label: "Hoy" },
  { key: `${BASE}/habits`, icon: <FireOutlined />, label: "Habitos" },
  { key: `${BASE}/tasks`, icon: <CheckSquareOutlined />, label: "Tareas" },
  { key: `${BASE}/stats`, icon: <LineChartOutlined />, label: "Estadisticas" },
];

const pageTitles: Record<string, string> = {
  [BASE]: "Hoy",
  [`${BASE}/habits`]: "Habitos",
  [`${BASE}/tasks`]: "Tareas",
  [`${BASE}/stats`]: "Estadisticas",
};

function isNavActive(pathname: string, itemKey: string): boolean {
  if (itemKey === BASE) return pathname === BASE || pathname === `${BASE}/`;
  return pathname === itemKey || pathname.startsWith(itemKey + "/");
}

function resolveTitle(pathname: string): string {
  if (pathname.startsWith(`${BASE}/habits/`)) return "Detalle de habito";
  const match = navItems.find((item) => isNavActive(pathname, item.key));
  return match ? pageTitles[match.key] ?? match.label : "HabitFer";
}

export function HabitFerShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [profileOpen, setProfileOpen] = useState(false);
  const selectedKey = navItems.find((item) => isNavActive(location.pathname, item.key))?.key ?? BASE;

  const openProfile = () => setProfileOpen(true);

  return (
    <div className="app-shell">
      <Layout className="app-shell__inner" style={{ minHeight: "100dvh", background: "transparent" }}>
        {!isMobile && (
          <Sider width={248} className="app-shell__sider">
            <div className="app-shell__brand app-shell__brand--habit">HabitFer</div>
            <nav className="app-shell__nav">
              {navItems.map((item) => {
                const active = selectedKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigate(item.key)}
                    className={`app-nav-btn app-nav-btn--habit ${active ? "app-nav-btn--active" : ""}`}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
              <button type="button" onClick={openProfile} className="app-nav-btn app-nav-btn--habit">
                <span style={{ fontSize: 18 }}><UserOutlined /></span>
                Perfil
              </button>
            </nav>
          </Sider>
        )}
        <Layout style={{ background: "transparent" }}>
          <Header
            className="app-shell__header"
            style={{
              padding: isMobile ? "0 16px" : "0 40px",
              height: isMobile ? 56 : 64,
            }}
          >
            <span className="app-shell__header-title" style={{ fontSize: isMobile ? 17 : 20 }}>
              {resolveTitle(location.pathname)}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button type="button" className="profile-trigger profile-trigger--habit" onClick={openProfile} aria-label="Perfil">
                <UserOutlined />
              </button>
              <AppSwitcher />
              <RemindersBell />
            </div>
          </Header>
          <Content
            className="app-shell__content"
            style={{
              padding: isMobile ? "12px 16px 100px" : "32px 40px 40px",
              maxWidth: isMobile ? "100%" : 1400,
            }}
          >
            <Outlet />
          </Content>
          {isMobile && (
            <nav className="mobile-tab-bar">
              {[
                ...navItems.slice(0, 3),
                navItems[3],
                { key: "profile", icon: <UserOutlined />, label: "Perfil" },
              ].map((item) => {
                const isProfile = item.key === "profile";
                const isActive = !isProfile && isNavActive(location.pathname, item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => (isProfile ? openProfile() : navigate(item.key))}
                    className={`mobile-tab-btn mobile-tab-btn--habit ${isActive ? "mobile-tab-btn--active" : ""}`}
                  >
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    {item.key.includes("stats") ? "Stats" : item.label}
                  </button>
                );
              })}
            </nav>
          )}
        </Layout>
      </Layout>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
