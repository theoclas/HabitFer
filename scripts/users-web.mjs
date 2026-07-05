import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");

let types = fs.readFileSync(path.join(root, "web/src/types.ts"), "utf8");
if (!types.includes("role:")) {
  types = types.replace(
    "  fullName: string;\n};",
    "  fullName: string;\n  role?: \"USER\" | \"ADMIN\";\n};"
  );
  fs.appendFileSync(path.join(root, "web/src/types.ts"), `

export type ManagedUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: "USER" | "ADMIN";
  createdAt: string;
  updatedAt: string;
};

export type CreateUserPayload = {
  email: string;
  username: string;
  fullName: string;
  password: string;
  role?: "USER" | "ADMIN";
};
`, "utf8");
}

fs.appendFileSync(path.join(root, "web/src/api/client.ts"), `

import type { CreateUserPayload, ManagedUser } from "../types";

export async function fetchUsers() {
  const { data } = await api.get<ManagedUser[]>("/users");
  return data;
}

export async function createUser(payload: CreateUserPayload) {
  const { data } = await api.post<ManagedUser>("/users", payload);
  return data;
}

export async function updateUser(id: string, payload: Partial<CreateUserPayload>) {
  const { data } = await api.patch<ManagedUser>("/users/" + id, payload);
  return data;
}

export async function deleteUser(id: string) {
  await api.delete("/users/" + id);
}
`, "utf8");

const usersPage = `import { DeleteOutlined, PlusOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Card, Drawer, Form, Input, List, Modal, Select, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { createUser, deleteUser, fetchUsers } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import type { CreateUserPayload, ManagedUser } from "../types";

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CreateUserPayload>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await fetchUsers());
    } catch {
      message.error("No tienes permiso o fallo la carga");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (user?.role !== "ADMIN") {
    return <Typography.Text type="danger">Solo administradores pueden gestionar usuarios.</Typography.Text>;
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>Usuarios</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>Nuevo usuario</Button>
      </div>

      <List
        loading={loading}
        dataSource={users}
        locale={{ emptyText: "Sin usuarios" }}
        renderItem={(u) => (
          <Card size="small" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <Typography.Text strong><UserOutlined /> {u.fullName}</Typography.Text>
                <div><Typography.Text type="secondary">@{u.username} · {u.email}</Typography.Text></div>
                <Tag color={u.role === "ADMIN" ? "cyan" : "default"} style={{ marginTop: 8 }}>{u.role}</Tag>
              </div>
              {u.id !== user?.id && (
                <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(u)} />
              )}
            </div>
          </Card>
        )}
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
          <Form.Item name="password" label="Contrasena" rules={[{ required: true, min: 6 }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item name="role" label="Rol">
            <Select size="large" options={[{ value: "USER", label: "Usuario" }, { value: "ADMIN", label: "Administrador" }]} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
`;
fs.writeFileSync(path.join(root, "web/src/pages/UsersPage.tsx"), usersPage, "utf8");

let profile = fs.readFileSync(path.join(root, "web/src/pages/ProfilePage.tsx"), "utf8");
if (!profile.includes("Usuarios")) {
  profile = profile.replace(
    'import { Button, Card, Descriptions, Typography } from "antd";',
    'import { Button, Card, Descriptions, Typography } from "antd";\nimport { Link } from "react-router-dom";'
  );
  profile = profile.replace(
    "          <Descriptions.Item label=\"Email\">{user?.email}</Descriptions.Item>",
    "          <Descriptions.Item label=\"Email\">{user?.email}</Descriptions.Item>\n          <Descriptions.Item label=\"Rol\">{user?.role ?? \"USER\"}</Descriptions.Item>"
  );
  profile = profile.replace(
    "        <Button danger onClick={handleLogout}",
    "        {user?.role === \"ADMIN\" && (\n          <Link to=\"/app/users\">\n            <Button block style={{ marginTop: 16 }}>Gestionar usuarios</Button>\n          </Link>\n        )}\n        <Button danger onClick={handleLogout}"
  );
  fs.writeFileSync(path.join(root, "web/src/pages/ProfilePage.tsx"), profile, "utf8");
}

let router = fs.readFileSync(path.join(root, "web/src/router.tsx"), "utf8");
if (!router.includes("UsersPage")) {
  router = router.replace(
    'import { TodayPage } from "./pages/TodayPage";',
    'import { TodayPage } from "./pages/TodayPage";\nimport { UsersPage } from "./pages/UsersPage";'
  );
  router = router.replace(
    '<Route path="profile" element={<ProfilePage />} />',
    '<Route path="profile" element={<ProfilePage />} />\n          <Route path="users" element={<UsersPage />} />'
  );
  fs.writeFileSync(path.join(root, "web/src/router.tsx"), router, "utf8");
}

console.log("users web ok");
