import { AppstoreOutlined, DownOutlined } from "@ant-design/icons";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { APPS, type AppId, setLastApp } from "./apps";

function detectCurrentApp(pathname: string): AppId {
  if (pathname.startsWith("/app/proyecfer")) return "proyecfer";
  return "habitfer";
}

export function AppSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const current = detectCurrentApp(location.pathname);
  const config = APPS[current];

  const items: MenuProps["items"] = (Object.values(APPS) as (typeof APPS)[AppId][]).map((app) => ({
    key: app.id,
    label: (
      <div>
        <div style={{ fontWeight: 700, color: app.color }}>{app.name}</div>
        <div style={{ fontSize: 11, color: "#64748b" }}>{app.description}</div>
      </div>
    ),
  }));

  const onClick: MenuProps["onClick"] = ({ key }) => {
    const id = key as AppId;
    if (id === current) return;
    setLastApp(id);
    navigate(APPS[id].basePath);
  };

  return (
    <Dropdown menu={{ items, onClick, selectedKeys: [current] }} trigger={["click"]}>
      <button
        type="button"
        className="app-switcher-btn"
        style={{
          "--switcher-border": `${config.color}44`,
          "--switcher-bg": `${config.color}14`,
          "--switcher-color": config.color,
        } as React.CSSProperties}
      >
        <AppstoreOutlined />
        {config.name}
        <DownOutlined style={{ fontSize: 10, opacity: 0.7 }} />
      </button>
    </Dropdown>
  );
}
