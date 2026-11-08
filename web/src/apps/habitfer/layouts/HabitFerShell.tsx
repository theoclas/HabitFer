import { Button, ConfigProvider, Layout } from "antd";
import {
  CalendarOutlined,
  CheckSquareOutlined,
  FireOutlined,
  LineChartOutlined,
  PlusOutlined,
  TrophyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { HabitEditorDrawer } from "../../../components/HabitEditorDrawer";
import { ProfileModal } from "../../../components/ProfileModal";
import { AchievementProvider } from "../../../features/achievements/AchievementContext";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { RemindersBell } from "../../../features/reminders/RemindersBell";
import { AppSwitcher } from "../../../platform/AppSwitcher";
import { Flame, FLAME_STAGES } from "../components/Flame";
import { MotivationalBanner } from "../components/MotivationalBanner";
import { notifyHabitsChanged } from "../effects";
import { brasaTheme } from "../theme/brasaTheme";
import "../theme/brasa.css";

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const selectedKey = navItems.find((item) => isNavActive(location.pathname, item.key))?.key ?? BASE;
  const onToday = selectedKey === BASE && !location.pathname.startsWith(`${BASE}/habits/`);

  const go = (key: string) => navigate(key, { viewTransition: true });
  const openProfile = () => setProfileOpen(true);
  const openCreator = () => setCreatorOpen(true);

  const tabs = [navItems[0], navItems[1], null, navItems[2], { ...navItems[3], label: "Stats" }];

  return (
    <ConfigProvider theme={brasaTheme}>
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
                style={{ padding: isMobile ? "0 16px" : "0 40px", height: isMobile ? 56 : 64 }}
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
                  <RemindersBell />
                  <button type="button" className="profile-trigger profile-trigger--habit" onClick={openProfile} aria-label="Perfil">
                    <UserOutlined />
                  </button>
                </div>
              </Header>
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
