import { CalendarOutlined, ProjectOutlined, RightOutlined } from "@ant-design/icons";
import { Card, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { APPS, type AppId, setLastApp } from "./apps";

const icons: Record<AppId, React.ReactNode> = {
  habitfer: <CalendarOutlined />,
  proyecfer: <ProjectOutlined />,
};

export function AppPickerPage() {
  const navigate = useNavigate();

  const pick = (id: AppId) => {
    setLastApp(id);
    navigate(APPS[id].basePath, { replace: true });
  };

  return (
    <div className="picker-page">
      <div className="picker-card-wrap">
        <Typography.Title level={2} className="picker-title">
          Bienvenido a Fersua
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: "center", marginBottom: 32 }}>
          Elige donde quieres empezar. Puedes cambiar en cualquier momento desde arriba a la derecha.
        </Typography.Paragraph>
        <div style={{ display: "grid", gap: 14 }}>
          {(Object.values(APPS) as (typeof APPS)[AppId][]).map((app) => (
            <Card
              key={app.id}
              hoverable
              className="picker-app-card"
              onClick={() => pick(app.id)}
              style={{
                borderColor: `${app.color}44`,
                background: `linear-gradient(135deg, ${app.color}12, rgba(18, 18, 26, 0.95))`,
              }}
              styles={{ body: { padding: "20px 22px" } }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div
                  className="picker-app-card__icon"
                  style={{ background: `${app.color}20`, color: app.color }}
                >
                  {icons[app.id]}
                </div>
                <div style={{ flex: 1 }}>
                  <Typography.Title level={4} style={{ margin: 0, color: app.color, fontFamily: "var(--font-display)" }}>
                    {app.name}
                  </Typography.Title>
                  <Typography.Text type="secondary">{app.description}</Typography.Text>
                </div>
                <RightOutlined style={{ color: app.color, opacity: 0.7 }} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
