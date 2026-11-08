import { Button, ConfigProvider, Layout, message } from "antd";
import {
  CalendarOutlined,
  CheckSquareOutlined,
  FireOutlined,
  LineChartOutlined,
  PlusOutlined,
  TrophyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { HabitEditorDrawer } from "../../../components/HabitEditorDrawer";
import { ProfileModal } from "../../../components/ProfileModal";
import { AchievementProvider } from "../../../features/achievements/AchievementContext";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { RemindersBell } from "../../../features/reminders/RemindersBell";
import { AppSwitcher } from "../../../platform/AppSwitcher";
import { DisplayMenu } from "../components/DisplayMenu";
import { Flame, FLAME_STAGES } from "../components/Flame";
import { MotivationalBanner } from "../components/MotivationalBanner";
import { NotificationsSheet } from "../components/NotificationsSheet";
import { OfflineChip } from "../components/OfflineChip";
import { notifyHabitsChanged } from "../effects";
import { flushQueue, queuedCount } from "../offline";
import { resyncPush } from "../push";
import { brasaThemeFor } from "../theme/brasaTheme";
import { useHfTheme } from "../theme/useHfTheme";
import "../theme/brasa.css";
import "../theme/brasa-data.css";
import "../theme/brasa-app.css";
import "../theme/brasa-day.css";

const { Content, Sider, Header } = Layout;
/** La marca usa la llama naranja: en tamano chico la azul se lee como una gota. */
const BRAND_STAGE = FLAME_STAGES[1];
const BASE = "/app/habitfer";

const navItems = [
  { key: BASE, icon: <CalendarOutlined />, label: "Hoy" },
  { key: `${BASE}/habits`, icon: <FireOutlined />, label: "Hábitos" },
  { key: `${BASE}/tasks`, icon: <CheckSquareOutlined />, label: "Tareas" },
  { key: `${BASE}/stats`, icon: <LineChartOutlined />, label: "Estadísticas" },
  { key: `${BASE}/logros`, icon: <TrophyOutlined />, label: "Logros" },
];

function isNavActive(pathname: string, itemKey: string): boolean {
  if (itemKey === BASE) return pathname === BASE || pathname === `${BASE}/`;
  return pathname === itemKey || pathname.startsWith(itemKey + "/");
}

function resolveTitle(pathname: string): string {
  if (pathname.startsWith(`${BASE}/habits/`)) return "Hábito";
  const match = navItems.find((item) => isNavActive(pathname, item.key));
  return match ? match.label : "HabitFer";
}

function Brand({ className }: { className?: string }) {
  return (
    <span className={`hf-brand${className ? " " + className : ""}`}>
      <Flame stage={BRAND_STAGE} size={22} glow />
      HabitFer
    </span>
  );
}

export function HabitFerShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { pref, mode, setPref } = useHfTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const selectedKey = navItems.find((item) => isNavActive(location.pathname, item.key))?.key ?? BASE;
  const onToday = selectedKey === BASE && !location.pathname.startsWith(`${BASE}/habits/`);

  // Acceso directo "Nuevo habito" del icono de la app: /app/habitfer?nuevo=1
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("nuevo") === "1") {
      setCreatorOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  // Lo marcado sin conexion se envia al volver la señal (y al abrir o volver a la app).
  useEffect(() => {
    const flush = async () => {
      const sent = await flushQueue();
      if (sent > 0) message.success(sent === 1 ? "Se envió el cambio que hiciste sin conexión" : `Se enviaron ${sent} cambios que hiciste sin conexión`);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    void flush();
    void resyncPush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (queuedCount() > 0) void flush();
    }, 30000);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  const go = (key: string) => navigate(key, { viewTransition: true });
  const openProfile = () => setProfileOpen(true);
  const openCreator = () => setCreatorOpen(true);

  const tabs = [navItems[0], navItems[1], null, navItems[2], { ...navItems[3], label: "Stats" }];

  return (
    <ConfigProvider theme={brasaThemeFor(mode)}>
      <AchievementProvider>
        <div className="app-shell app-shell--habitfer">
          <Layout className="app-shell__inner" style={{ minHeight: "100dvh", background: "transparent" }}>
            {!isMobile && (
              <Sider width={248} className="app-shell__sider">
                <div className="app-shell__brand hf-brand">
                  <Flame stage={BRAND_STAGE} size={24} glow />
                  HabitFer
                </div>
                <nav className="app-shell__nav" aria-label="HabitFer">
                  {navItems.map((item) => {
                    const active = selectedKey === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => go(item.key)}
                        className={`app-nav-btn app-nav-btn--habit ${active ? "app-nav-btn--active" : ""}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <span style={{ fontSize: 18 }}>{item.icon}</span>
                        {item.label}
                      </button>
                    );
                  })}
                  <button type="button" onClick={openProfile} className="app-nav-btn app-nav-btn--habit">
                    <span style={{ fontSize: 18 }}>
                      <UserOutlined />
                    </span>
                    Perfil
                  </button>
                </nav>
                <Button type="primary" size="large" icon={<PlusOutlined />} className="hf-nav-new" onClick={openCreator}>
                  Nuevo hábito
                </Button>
              </Sider>
            )}
            <Layout style={{ background: "transparent" }}>
              <Header
                className="app-shell__header"
                style={{
                  // Instalada en iPhone la barra de estado queda encima: se suma su alto.
                  padding: isMobile ? "env(safe-area-inset-top, 0px) 16px 0" : "0 40px",
                  height: isMobile ? "calc(56px + env(safe-area-inset-top, 0px))" : 64,
                }}
              >
                {isMobile && onToday ? (
                  <Brand />
                ) : (
                  <span className="app-shell__header-title" style={{ fontSize: isMobile ? 18 : 20 }}>
                    {resolveTitle(location.pathname)}
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <AppSwitcher />
                  <DisplayMenu pref={pref} mode={mode} onPref={setPref} onNotifications={() => setNotifOpen(true)} />
                  <RemindersBell />
                  <button type="button" className="profile-trigger profile-trigger--habit" onClick={openProfile} aria-label="Perfil">
                    <UserOutlined />
                  </button>
                </div>
              </Header>
              <OfflineChip />
              <MotivationalBanner />
              <Content
                className="app-shell__content"
                style={{ padding: isMobile ? "14px 16px 112px" : "28px 40px 40px", maxWidth: isMobile ? "100%" : 1400 }}
              >
                <Outlet />
              </Content>
              {isMobile && (
                <nav className="hf-tabbar" aria-label="HabitFer">
                  {tabs.map((item) =>
                    item === null ? (
                      <button key="new" type="button" className="hf-tab-plus" onClick={openCreator} aria-label="Nuevo hábito">
                        <PlusOutlined />
                      </button>
                    ) : (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => go(item.key)}
                        className={`hf-tab ${isNavActive(location.pathname, item.key) ? "hf-tab--active" : ""}`}
                        aria-current={isNavActive(location.pathname, item.key) ? "page" : undefined}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ),
                  )}
                </nav>
              )}
            </Layout>
          </Layout>
          <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
          <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
          <HabitEditorDrawer
            open={creatorOpen}
            habit={null}
            onClose={() => setCreatorOpen(false)}
            onSaved={notifyHabitsChanged}
          />
        </div>
      </AchievementProvider>
    </ConfigProvider>
  );
}
