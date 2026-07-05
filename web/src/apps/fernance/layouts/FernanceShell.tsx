import {
  CreditCardOutlined,
  DollarOutlined,
  PieChartOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Layout } from "antd";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ProfileModal } from "../../../components/ProfileModal";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { AppSwitcher } from "../../../platform/AppSwitcher";
import { FinanceProvider } from "../context/FinanceContext";
import "../theme/fernance.css";

const { Content, Sider, Header } = Layout;
const BASE = "/app/fernance";

const navItems = [
  { key: BASE, icon: <PieChartOutlined />, label: "Resumen" },
  { key: `${BASE}/accounts`, icon: <WalletOutlined />, label: "Cuentas" },
  { key: `${BASE}/incomes`, icon: <DollarOutlined />, label: "Ingresos" },
  { key: `${BASE}/credits`, icon: <CreditCardOutlined />, label: "Creditos" },
];

const pageTitles: Record<string, string> = {
  [BASE]: "Resumen",
  [`${BASE}/accounts`]: "Cuentas",
  [`${BASE}/incomes`]: "Ingresos",
  [`${BASE}/credits`]: "Creditos",
};

function isNavActive(pathname: string, itemKey: string): boolean {
  if (itemKey === BASE) return pathname === BASE || pathname === `${BASE}/`;
  return pathname === itemKey || pathname.startsWith(itemKey + "/");
}

function resolveTitle(pathname: string): string {
  if (pathname.includes("/credits/")) return "Detalle credito";
  const match = navItems.find((item) => isNavActive(pathname, item.key));
  return match ? pageTitles[match.key] ?? match.label : "Fernance";
}

function FernanceShellInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [profileOpen, setProfileOpen] = useState(false);
  const selectedKey = navItems.find((item) => isNavActive(location.pathname, item.key))?.key ?? BASE;

  return (
    <div className="app-shell app-shell--fernance">
      <Layout className="app-shell__inner" style={{ minHeight: "100dvh", background: "transparent" }}>
        {!isMobile && (
          <Sider width={248} className="app-shell__sider">
            <div className="app-shell__brand app-shell__brand--fern">
              <span className="fern-logo" aria-hidden>
                ✦
              </span>
              Fernance
            </div>
            <nav className="app-shell__nav">
              {navItems.map((item) => {
                const active = selectedKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigate(item.key)}
                    className={`app-nav-btn app-nav-btn--fern ${active ? "app-nav-btn--active" : ""}`}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
              <button type="button" onClick={() => setProfileOpen(true)} className="app-nav-btn app-nav-btn--fern">
                <span style={{ fontSize: 18 }}><UserOutlined /></span>
                Perfil
              </button>
            </nav>
          </Sider>
        )}
        <Layout style={{ background: "transparent" }}>
          <Header
            className="app-shell__header"
            style={{ padding: isMobile ? "0 16px" : "0 40px", height: isMobile ? 56 : 64 }}
          >
            <span className="app-shell__header-title" style={{ fontSize: isMobile ? 17 : 20, color: "#F5C542" }}>
              {resolveTitle(location.pathname)}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button type="button" className="profile-trigger profile-trigger--fern" onClick={() => setProfileOpen(true)} aria-label="Perfil">
                <UserOutlined />
              </button>
              <AppSwitcher />
            </div>
          </Header>
          <Content
            className="app-shell__content"
            style={{ padding: isMobile ? "12px 16px 100px" : "32px 40px 40px", maxWidth: isMobile ? "100%" : 1200 }}
          >
            <Outlet />
          </Content>
          {isMobile && (
            <nav className="mobile-tab-bar">
              {[
                navItems[0],
                navItems[1],
                navItems[2],
                navItems[3],
                { key: "profile", icon: <UserOutlined />, label: "Perfil" },
              ].map((item) => {
                const isProfile = item.key === "profile";
                const isActive = !isProfile && isNavActive(location.pathname, item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => (isProfile ? setProfileOpen(true) : navigate(item.key))}
                    className={`mobile-tab-btn mobile-tab-btn--fern ${isActive ? "mobile-tab-btn--active" : ""}`}
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

export function FernanceShell() {
  return (
    <FinanceProvider>
      <FernanceShellInner />
    </FinanceProvider>
  );
}
