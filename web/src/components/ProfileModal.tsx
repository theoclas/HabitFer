import { LogoutOutlined, MailOutlined, SettingOutlined } from "@ant-design/icons";
import { Avatar, Button, Modal, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getLastApp, APPS } from "../platform/apps";

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  USER: { label: "Usuario", color: "blue" },
  ADMIN: { label: "Admin", color: "gold" },
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ProfileModal({ open, onClose }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const lastApp = getLastApp();
  const accent = lastApp ? APPS[lastApp].color : "#6366f1";
  const role = ROLE_LABELS[user?.role ?? "USER"] ?? ROLE_LABELS.USER;

  const handleLogout = () => {
    void logout().then(() => {
      onClose();
      navigate("/login", { replace: true });
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={380}
      className="profile-modal"
      destroyOnClose
      title={null}
      closable
    >
      <div className="profile-modal__body">
        <Avatar
          size={72}
          className="profile-card__avatar"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
        >
          {initials(user?.fullName)}
        </Avatar>
        <Typography.Title level={4} className="profile-modal__name">
          {user?.fullName}
        </Typography.Title>
        <Typography.Text type="secondary">@{user?.username}</Typography.Text>
        <Tag color={role.color} style={{ marginTop: 10 }}>{role.label}</Tag>

        <div className="profile-modal__email">
          <MailOutlined /> {user?.email}
        </div>

        <div className="profile-modal__actions">
          {user?.role === "ADMIN" && (
            <Button
              block
              icon={<SettingOutlined />}
              onClick={() => {
                onClose();
                navigate("/app/users");
              }}
              style={{ marginBottom: 8 }}
            >
              Gestionar usuarios
            </Button>
          )}
          <Button block danger icon={<LogoutOutlined />} onClick={handleLogout} className="profile-card__logout">
            Cerrar sesion
          </Button>
        </div>
      </div>
    </Modal>
  );
}
