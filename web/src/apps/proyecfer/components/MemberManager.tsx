import { DeleteOutlined, UserAddOutlined } from "@ant-design/icons";
import { AutoComplete, Button, Card, Select, Tag, Typography, message } from "antd";
import { useState } from "react";
import { addWorkspaceMember, removeWorkspaceMember, searchWorkspaceUsers } from "../../../api/proyecfer";
import type { WorkspaceDetail, WorkspaceRole, WorkspaceUser } from "../../../types/proyecfer";

type Props = {
  workspace: WorkspaceDetail;
  onChanged: () => void;
};

export function MemberManager({ workspace, onChanged }: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<WorkspaceUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<WorkspaceUser | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("EDITOR");

  const canManage = workspace.myRole === "OWNER" || workspace.myRole === "ADMIN";

  const onSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    try {
      setOptions(await searchWorkspaceUsers(workspace.id, q));
    } catch {
      setOptions([]);
    }
  };

  const handleAdd = async () => {
    if (!selectedUser) return;
    try {
      await addWorkspaceMember(workspace.id, selectedUser.id, role);
      message.success("Miembro agregado");
      setSelectedUser(null);
      setQuery("");
      onChanged();
    } catch {
      message.error("No se pudo agregar");
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeWorkspaceMember(workspace.id, userId);
      message.success("Miembro eliminado");
      onChanged();
    } catch {
      message.error("No se pudo eliminar");
    }
  };

  return (
    <Card title="Miembros" size="small" className="panel-card">
      {canManage && (
        <div style={{ marginBottom: 12 }}>
          <AutoComplete
            style={{ width: "100%", marginBottom: 8 }}
            value={query}
            options={options.map((u) => ({ value: u.id, label: `${u.fullName} (@${u.username})` }))}
            onSearch={onSearch}
            onSelect={(id) => {
              const u = options.find((x) => x.id === id);
              if (u) {
                setSelectedUser(u);
                setQuery(u.fullName);
              }
            }}
            placeholder="Buscar usuario..."
          />
          <Select
            style={{ width: "100%", marginBottom: 8 }}
            value={role}
            onChange={setRole}
            options={[
              { value: "EDITOR", label: "Editor" },
              { value: "VIEWER", label: "Lector" },
              { value: "ADMIN", label: "Admin" },
            ]}
          />
          <Button type="primary" block className="btn-proyec" icon={<UserAddOutlined />} onClick={() => void handleAdd()} disabled={!selectedUser}>
            Agregar colaborador
          </Button>
        </div>
      )}
      {workspace.members.map((m) => (
        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <Typography.Text>{m.user.fullName}</Typography.Text>
            <Tag style={{ marginLeft: 8 }}>{m.role}</Tag>
          </div>
          {canManage && m.role !== "OWNER" && (
            <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => void handleRemove(m.userId)} />
          )}
        </div>
      ))}
    </Card>
  );
}
