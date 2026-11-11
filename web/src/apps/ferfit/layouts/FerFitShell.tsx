import { AppstoreOutlined, BulbOutlined, CalendarOutlined, MoonOutlined, OrderedListOutlined, SunOutlined, UserOutlined } from "@ant-design/icons";
import { ConfigProvider } from "antd";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ProfileModal } from "../../../components/ProfileModal";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { AppSwitcher } from "../../../platform/AppSwitcher";
import { setLastApp } from "../../../platform/apps";
import { cicloviaThemeFor } from "../theme/cicloviaTheme";
import { useFfTheme, type FfThemePref } from "../theme/useFfTheme";
import "../theme/ferfit.css";

export const FF_BASE = "/app/ferfit";
const NAV = [
  { key: FF_BASE, label: "Hoy", icon: <CalendarOutlined /> },
  { key: `${FF_BASE}/rutinas`, label: "Rutinas", icon: <OrderedListOutlined />, also: [`${FF_BASE}/listas`] },
  { key: `${FF_BASE}/ejercicios`, label: "Ejercicios", icon: <AppstoreOutlined /> },
];

const NEXT_PREF: Record<FfThemePref, FfThemePref> = { auto: "light", light: "dark", dark: "auto" };
const PREF_LABEL: Record<FfThemePref, string> = { auto: "Tema: el del teléfono", light: "Tema: claro", dark: "Tema: oscuro" };

/** FerFit: ejercicio en casa. Encabezado propio, «Hoy», «Rutinas» y «Ejercicios». */
export function FerFitShell() {
  const { pref, mode, setPref } = useFfTheme();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setLastApp("ferfit");
  }, []);

  const current =
    NAV.find((n) => n.key !== FF_BASE && [n.key, ...(n.also ?? [])].some((k) => location.pathname.startsWith(k)))?.key ?? FF_BASE;
  const themeIcon = pref === "auto" ? <BulbOutlined /> : pref === "light" ? <SunOutlined /> : <MoonOutlined />;

  return (
    <ConfigProvider theme={cicloviaThemeFor(mode)}>
      <div className="fit-shell">
        <header className="fit-header">
          <div className="fit-brand">
            <span className="fit-brand__mark" aria-hidden="true" />
            FerFit
          </div>
          {!isMobile && (
            <nav className="fit-topnav" aria-label="Secciones de FerFit">
              {NAV.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="fit-navlink"
                  aria-current={current === item.key ? "page" : undefined}
                  onClick={() => navigate(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
          <div className="fit-header__actions">
            <button
              type="button"
              className="fit-icon-btn"
              onClick={() => setPref(NEXT_PREF[pref])}
              aria-label={`${PREF_LABEL[pref]}. Toca para cambiar`}
              title={PREF_LABEL[pref]}
            >
              {themeIcon}
            </button>
            <button type="button" className="fit-icon-btn" onClick={() => setProfileOpen(true)} aria-label="Tu cuenta">
              <UserOutlined />
            </button>
            <AppSwitcher compact={isMobile} />
          </div>
        </header>

        <main className="fit-main">
          <Outlet />
        </main>

        {isMobile && (
          <nav className="fit-tabbar" aria-label="Secciones de FerFit">
            {NAV.map((item) => (
              <button
                key={item.key}
                type="button"
                className="fit-tab"
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
