import { Layout } from "antd";
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  FolderOutlined,
  HomeOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ProfileModal } from "../../../components/ProfileModal";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { CollabNotificationsBell } from "../components/CollabNotificationsBell";
import { AppSwitcher } from "../../../platform/AppSwitcher";
import { resolveProyecFerBack, resolveProyecFerTitle } from "../navigation";

const { Content, Sider, Header } = Layout;
const BASE = "/app/proyecfer";

const navItems = [
  { key: BASE, icon: <HomeOutlined />, label: "Inicio" },
  { key: `${BASE}/workspaces`, icon: <TeamOutlined />, label: "Workspaces" },
  { key: `${BASE}/stats`, icon: <BarChartOutlined />, label: "Stats" },
];

function isNavActive(pathname: string, itemKey: string): boolean {
  if (itemKey === BASE) return pathname === BASE || pathname === `${BASE}/`;
  return pathname === itemKey || pathname.startsWith(itemKey + "/");
}

export function ProyecFerShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [profileOpen, setProfileOpen] = useState(false);
  const selectedKey = navItems.find((item) => isNavActive(location.pathname, item.key))?.key ?? BASE;
  const back = resolveProyecFerBack(location.pathname);

  const openProfile = () => setProfileOpen(true);

  return (
    <div className="app-shell app-shell--proyecfer">
      <Layout className="app-shell__inner" style={{ minHeight: "100dvh", background: "transparent" }}>
        {!isMobile && (
          <Sider width={248} className="app-shell__sider">
            <div className="app-shell__brand app-shell__brand--proyec">ProyecFer</div>
            <nav className="app-shell__nav">
              {navItems.map((item) => {
                const active = selectedKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigate(item.key)}
                    className={`app-nav-btn app-nav-btn--proyec ${active ? "app-nav-btn--active" : ""}`}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
              <button type="button" onClick={openProfile} className="app-nav-btn app-nav-btn--proyec">
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
            <div className="app-shell__header-start">
              {back && (
                <button
                  type="button"
                  className="app-shell__back"
                  onClick={() => navigate(back.to)}
                  aria-label={`Volver a ${back.label}`}
                  title={`Volver a ${back.label}`}
                >
                  <ArrowLeftOutlined />
                </button>
              )}
              <span className="app-shell__header-title" style={{ fontSize: isMobile ? 17 : 20 }}>
                {resolveProyecFerTitle(location.pathname)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button type="button" className="profile-trigger profile-trigger--proyec" onClick={openProfile} aria-label="Perfil">
                <UserOutlined />
              </button>
              <AppSwitcher />
              <CollabNotificationsBell />
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
                { key: BASE, icon: <HomeOutlined />, label: "Inicio" },
                { key: `${BASE}/workspaces`, icon: <FolderOutlined />, label: "Espacios" },
                { key: `${BASE}/stats`, icon: <BarChartOutlined />, label: "Stats" },
                { key: "profile", icon: <UserOutlined />, label: "Perfil" },
              ].map((item) => {
                const isProfile = item.key === "profile";
                const isActive = !isProfile && isNavActive(location.pathname, item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => (isProfile ? openProfile() : navigate(item.key))}
                    className={`mobile-tab-btn mobile-tab-btn--proyec ${isActive ? "mobile-tab-btn--active" : ""}`}
                  >
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    {item.label}
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
