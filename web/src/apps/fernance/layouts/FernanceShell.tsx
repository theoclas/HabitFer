import { BankOutlined, BulbOutlined, CreditCardOutlined, MoonOutlined, PieChartOutlined, RiseOutlined, SunOutlined, UserOutlined } from "@ant-design/icons";
import { App as AntApp, ConfigProvider } from "antd";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ProfileModal } from "../../../components/ProfileModal";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { AppSwitcher } from "../../../platform/AppSwitcher";
import { setLastApp } from "../../../platform/apps";
import { FinanceProvider } from "../context/FinanceContext";
import { tumbagaThemeFor } from "../theme/tumbagaTheme";
import { useFfTheme, type FfThemePref } from "../theme/useFfTheme";
import "../theme/ferfinance.css";

const BASE = "/app/fernance";
const NAV = [
  { key: BASE, label: "Resumen", icon: <PieChartOutlined /> },
  { key: `${BASE}/incomes`, label: "Ingresos", icon: <RiseOutlined /> },
  { key: `${BASE}/credits`, label: "Créditos", icon: <CreditCardOutlined /> },
  { key: `${BASE}/accounts`, label: "Cuentas", icon: <BankOutlined /> },
];

const NEXT_PREF: Record<FfThemePref, FfThemePref> = { auto: "light", light: "dark", dark: "auto" };
const PREF_LABEL: Record<FfThemePref, string> = {
  auto: "Tema: el del teléfono",
  light: "Tema: claro",
  dark: "Tema: oscuro",
};

/** FerFinance: tus finanzas, con su propio encabezado, tema Tumbaga y barra de abajo en el teléfono. */
export function FernanceShell() {
  const { pref, mode, setPref } = useFfTheme();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setLastApp("fernance");
  }, []);

  const current = NAV.find((n) => n.key !== BASE && location.pathname.startsWith(n.key))?.key ?? BASE;
  const themeIcon = pref === "auto" ? <BulbOutlined /> : pref === "light" ? <SunOutlined /> : <MoonOutlined />;

  return (
    <ConfigProvider theme={tumbagaThemeFor(mode)}>
      <AntApp>
        <FinanceProvider>
          <div className="ff-shell">
            <header className="ff-header">
              <div className="ff-brand">
                <span className="ff-brand__mark" aria-hidden="true" />
                FerFinance
              </div>
              {!isMobile && (
                <nav className="ff-topnav" aria-label="Secciones de FerFinance">
                  {NAV.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className="ff-navlink"
                      aria-current={current === item.key ? "page" : undefined}
                      onClick={() => navigate(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              )}
              <div className="ff-header__actions">
                <button
                  type="button"
                  className="ff-icon-btn"
                  onClick={() => setPref(NEXT_PREF[pref])}
                  aria-label={`${PREF_LABEL[pref]}. Toca para cambiar`}
                  title={PREF_LABEL[pref]}
                >
                  {themeIcon}
                </button>
                <button type="button" className="ff-icon-btn" onClick={() => setProfileOpen(true)} aria-label="Tu cuenta">
                  <UserOutlined />
                </button>
                <AppSwitcher compact={isMobile} />
              </div>
            </header>

            <main className="ff-main">
              <Outlet />
            </main>

            {isMobile && (
              <nav className="ff-tabbar" aria-label="Secciones de FerFinance">
                {NAV.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="ff-tab"
                    aria-current={current === item.key ? "page" : undefined}
                    onClick={() => navigate(item.key)}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </nav>
            )}

            <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
          </div>
        </FinanceProvider>
      </AntApp>
    </ConfigProvider>
  );
}
