import {
  BankOutlined,
  BulbOutlined,
  CreditCardOutlined,
  MoonOutlined,
  PieChartOutlined,
  PlusOutlined,
  SunOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { App as AntApp, Button, ConfigProvider } from "antd";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ProfileModal } from "../../../components/ProfileModal";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { AppSwitcher } from "../../../platform/AppSwitcher";
import { setLastApp } from "../../../platform/apps";
import { QuickAddSheet } from "../components/QuickAddSheet";
import { FinanceProvider, useFinanceContext } from "../context/FinanceContext";
import { tumbagaThemeFor } from "../theme/tumbagaTheme";
import { useFfTheme, type FfThemePref } from "../theme/useFfTheme";
import "../theme/ferfinance.css";

const BASE = "/app/fernance";
const NAV = [
  { key: BASE, label: "Resumen", icon: <PieChartOutlined /> },
  { key: `${BASE}/movements`, label: "Movimientos", icon: <UnorderedListOutlined /> },
  { key: `${BASE}/credits`, label: "Créditos", icon: <CreditCardOutlined /> },
  { key: `${BASE}/accounts`, label: "Cuentas", icon: <BankOutlined /> },
];

const NEXT_PREF: Record<FfThemePref, FfThemePref> = { auto: "light", light: "dark", dark: "auto" };
const PREF_LABEL: Record<FfThemePref, string> = {
  auto: "Tema: el del teléfono",
  light: "Tema: claro",
  dark: "Tema: oscuro",
};

/** FerFinance: tus finanzas, con su propio encabezado, tema Tumbaga, barra de abajo y el botón de anotar. */
export function FernanceShell() {
  // Una sola vez: el tema vive aquí y baja al resto.
  const { pref, mode, setPref } = useFfTheme();
  return (
    <ConfigProvider theme={tumbagaThemeFor(mode)}>
      <AntApp>
        <FinanceProvider>
          <ShellBody pref={pref} setPref={setPref} />
        </FinanceProvider>
      </AntApp>
    </ConfigProvider>
  );
}

function ShellBody({ pref, setPref }: { pref: FfThemePref; setPref: (p: FfThemePref) => void }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { openQuickAdd, quickAdd, accountId } = useFinanceContext();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setLastApp("fernance");
  }, []);

  // En el computador, la tecla «n» abre «Anotar» (si no se está escribiendo en un campo).
  useEffect(() => {
    if (isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.ctrlKey || e.metaKey || e.altKey || quickAdd) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (document.querySelector(".ant-modal-wrap, .ant-drawer-open")) return;
      e.preventDefault();
      openQuickAdd(accountId ? { accountId } : {});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, quickAdd, openQuickAdd, accountId]);

  // Las categorías se abren desde Cuentas.
  const path = location.pathname.startsWith(`${BASE}/categories`) ? `${BASE}/accounts` : location.pathname;
  const current = NAV.find((n) => n.key !== BASE && path.startsWith(n.key))?.key ?? BASE;
  const themeIcon = pref === "auto" ? <BulbOutlined /> : pref === "light" ? <SunOutlined /> : <MoonOutlined />;
  const add = () => openQuickAdd(accountId ? { accountId } : {});

  return (
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
          {!isMobile && (
            <Button type="primary" icon={<PlusOutlined />} onClick={add} title="Anotar (tecla N)">
              Anotar
            </Button>
          )}
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
          {NAV.slice(0, 2).map((item) => (
            <button key={item.key} type="button" className="ff-tab" aria-current={current === item.key ? "page" : undefined} onClick={() => navigate(item.key)}>
              {item.icon}
              {item.label}
            </button>
          ))}
          <button type="button" className="ff-fab" onClick={add} aria-label="Anotar un gasto, un ingreso o una transferencia">
            <PlusOutlined />
            <span>Anotar</span>
          </button>
          {NAV.slice(2).map((item) => (
            <button key={item.key} type="button" className="ff-tab" aria-current={current === item.key ? "page" : undefined} onClick={() => navigate(item.key)}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      )}

      <QuickAddSheet />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
