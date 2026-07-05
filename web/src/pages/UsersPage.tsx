import { CheckOutlined, CloseOutlined, DeleteOutlined, PlusOutlined, StopOutlined, UserOutlined } from "@ant-design/icons";
import { Badge, Button, Card, Drawer, Form, Input, List, Modal, Select, Tabs, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import {
  approveUser,
  createUser,
  deleteUser,
  fetchUsers,
  rejectUser,
  suspendUser,
} from "../api/client";
import { BackButton } from "../components/BackButton";
import { useAuth } from "../contexts/AuthContext";
import { APPS, getLastApp, resolvePostLoginPath } from "../platform/apps";
import type { CreateUserPayload, ManagedUser } from "../types";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "orange",
  ACTIVE: "green",
  REJECTED: "red",
  SUSPENDED: "default",
};

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [pending, setPending] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CreateUserPayload>();

  const lastApp = getLastApp();
  const backTo = resolvePostLoginPath();
  const backLabel = lastApp ? `Volver a ${APPS[lastApp].name}` : "Volver";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, pend] = await Promise.all([fetchUsers(), fetchUsers("PENDING")]);
      setUsers(all.filter((u) => u.status !== "PENDING"));
      setPending(pend);
    } catch {
      message.error("No tienes permiso o fallo la carga");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (user?.role !== "ADMIN") {
    return (
      <div className="app-shell">
        <div className="standalone-page">
          <BackButton to={backTo} label={backLabel} />
          <Typography.Text type="danger">Solo administradores pueden gestionar usuarios.</Typography.Text>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await createUser(values);
      message.success("Usuario creado");
      setDrawerOpen(false);
      form.resetFields();
      await load();
    } catch {
      message.error("No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (u: ManagedUser) => {
    Modal.confirm({
      title: "Eliminar usuario?",
      content: u.fullName + " (@" + u.username + ")",
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        await deleteUser(u.id);
        message.success("Usuario eliminado");
        await load();
      },
    });
  };

  const renderUserCard = (u: ManagedUser, actions?: React.ReactNode) => (
    <Card size="small" style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <Typography.Text strong><UserOutlined /> {u.fullName}</Typography.Text>
          <div><Typography.Text type="secondary">@{u.username} · {u.email}</Typography.Text></div>
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Tag color={u.role === "ADMIN" ? "cyan" : "default"}>{u.role}</Tag>
            {u.status && <Tag color={STATUS_COLORS[u.status]}>{u.status}</Tag>}
          </div>
        </div>
        {actions}
      </div>
    </Card>
  );

  return (
    <div className="app-shell">
      <div className="standalone-page">
        <BackButton to={backTo} label={backLabel} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Typography.Title level={2} style={{ margin: 0 }}>Usuarios</Typography.Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>Nuevo usuario</Button>
        </div>

      <Tabs
        items={[
          {
            key: "pending",
            label: (
              <Badge count={pending.length} size="small" offset={[6, 0]}>
                Pendientes
              </Badge>
            ),
            children: (
              <List
                loading={loading}
                dataSource={pending}
                locale={{ emptyText: "Sin solicitudes pendientes" }}
                renderItem={(u) =>
                  renderUserCard(
                    u,
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button type="primary" icon={<CheckOutlined />} onClick={() => void approveUser(u.id).then(load)}>
                        Aprobar
                      </Button>
                      <Button danger icon={<CloseOutlined />} onClick={() => void rejectUser(u.id).then(load)}>
                        Rechazar
                      </Button>
                    </div>,
                  )
                }
              />
            ),
          },
          {
            key: "all",
            label: "Activos",
            children: (
              <List
                loading={loading}
                dataSource={users}
                locale={{ emptyText: "Sin usuarios" }}
                renderItem={(u) =>
                  renderUserCard(
                    u,
                    u.id !== user?.id && (
                      <div style={{ display: "flex", gap: 6 }}>
                        {u.status === "ACTIVE" && (
                          <Button icon={<StopOutlined />} onClick={() => void suspendUser(u.id).then(load)}>
                            Suspender
                          </Button>
                        )}
                        <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(u)} />
                      </div>
                    ),
                  )
                }
              />
            ),
          },
        ]}
      />

      <Drawer
        title="Crear usuario"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="bottom"
        extra={<Button type="primary" loading={saving} onClick={() => void handleCreate()}>Crear</Button>}
      >
        <Form form={form} layout="vertical" initialValues={{ role: "USER" }}>
          <Form.Item name="fullName" label="Nombre" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="username" label="Usuario" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Contrasena"
            rules={[
              { required: true, min: 12 },
              { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, message: "Mayuscula, minuscula y numero" },
            ]}
          >
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item name="role" label="Rol">
            <Select size="large" options={[{ value: "USER", label: "Usuario" }, { value: "ADMIN", label: "Administrador" }]} />
          </Form.Item>
        </Form>
      </Drawer>
      </div>
    </div>
  );
}
