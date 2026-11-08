import { AimOutlined, BulbOutlined, CalendarOutlined, FireOutlined, LineChartOutlined, MoonOutlined, SunOutlined, UserOutlined } from "@ant-design/icons";
import { ConfigProvider } from "antd";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ProfileModal } from "../../../components/ProfileModal";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { AppSwitcher } from "../../../platform/AppSwitcher";
import { setLastApp } from "../../../platform/apps";
import { plazaThemeFor } from "../theme/plazaTheme";
import { useNfTheme, type NfThemePref } from "../theme/useNfTheme";
import "../theme/nutrifer.css";

const BASE = "/app/nutrifer";
const NAV = [
  { key: BASE, label: "Hoy", icon: <CalendarOutlined /> },
  { key: `${BASE}/cocina`, label: "Cocina", icon: <FireOutlined /> },
  { key: `${BASE}/progreso`, label: "Progreso", icon: <LineChartOutlined /> },
  { key: `${BASE}/meta`, label: "Meta", icon: <AimOutlined /> },
];

const NEXT_PREF: Record<NfThemePref, NfThemePref> = { auto: "light", light: "dark", dark: "auto" };
const PREF_LABEL: Record<NfThemePref, string> = {
  auto: "Tema: el del teléfono",
  light: "Tema: claro",
  dark: "Tema: oscuro",
};

/** NutriFer: comida colombiana y calorías. Encabezado propio, «Hoy», «Cocina» y «Meta». */
export function NutriFerShell() {
  const { pref, mode, setPref } = useNfTheme();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setLastApp("nutrifer");
  }, []);

  const current = NAV.find((n) => n.key !== BASE && location.pathname.startsWith(n.key))?.key ?? BASE;
  const themeIcon = pref === "auto" ? <BulbOutlined /> : pref === "light" ? <SunOutlined /> : <MoonOutlined />;

  return (
    <ConfigProvider theme={plazaThemeFor(mode)}>
      <div className="nf-shell">
        <header className="nf-header">
          <div className="nf-brand">
            <span className="nf-brand__mark" aria-hidden="true" />
            NutriFer
          </div>
          {!isMobile && (
            <nav className="nf-topnav" aria-label="Secciones de NutriFer">
              {NAV.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="nf-navlink"
                  aria-current={current === item.key ? "page" : undefined}
                  onClick={() => navigate(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
          <div className="nf-header__actions">
            <button
              type="button"
              className="nf-icon-btn"
              onClick={() => setPref(NEXT_PREF[pref])}
              aria-label={`${PREF_LABEL[pref]}. Toca para cambiar`}
              title={PREF_LABEL[pref]}
            >
              {themeIcon}
            </button>
            <button type="button" className="nf-icon-btn" onClick={() => setProfileOpen(true)} aria-label="Tu cuenta">
              <UserOutlined />
            </button>
            <AppSwitcher compact={isMobile} />
          </div>
        </header>

        <main className="nf-main">
          <Outlet />
        </main>

        {isMobile && (
          <nav className="nf-tabbar" aria-label="Secciones de NutriFer">
            {NAV.map((item) => (
              <button
                key={item.key}
                type="button"
                className="nf-tab"
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
    </ConfigProvider>
  );
}
