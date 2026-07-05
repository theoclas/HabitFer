import { FolderOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Form, Input, Modal, Spin, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FeatureCard } from "../../../components/FeatureCard";
import { PageHero } from "../../../components/PageHero";
import { createWorkspace, fetchWorkspaces } from "../../../api/proyecfer";
import type { WorkspaceSummary } from "../../../types/proyecfer";

const ROLE_COLORS: Record<string, string> = {
  OWNER: "gold",
  ADMIN: "purple",
  EDITOR: "blue",
  VIEWER: "default",
};

export function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWorkspaces(await fetchWorkspaces());
    } catch {
      message.error("No se pudieron cargar workspaces");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(
    () => ({
      workspaces: workspaces.length,
      projects: workspaces.reduce((sum, w) => sum + w.projectCount, 0),
      members: workspaces.reduce((sum, w) => sum + w.memberCount, 0),
    }),
    [workspaces],
  );

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      await createWorkspace(values);
      message.success("Workspace creado");
      setModalOpen(false);
      form.resetFields();
      await load();
    } catch {
      message.error("No se pudo crear");
    }
  };

  return (
    <div className="workspaces-overview">
      <PageHero
        variant="proyec"
        title="Workspaces"
        subtitle="Panel de tus espacios de trabajo. Entra a cada uno para ver proyectos, tareas y actividad del equipo."
        actions={
          <Button type="primary" className="btn-proyec" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Nuevo workspace
          </Button>
        }
      />

      {!loading && workspaces.length > 0 && (
        <div className="stat-grid workspaces-overview__stats">
          <Card className="stat-card workspace-kpi-card" styles={{ body: { padding: "18px 20px" } }}>
            <Typography.Text type="secondary">Workspaces</Typography.Text>
            <Typography.Title level={2} style={{ margin: "6px 0 0", color: "#818cf8" }}>
              {totals.workspaces}
            </Typography.Title>
          </Card>
          <Card className="stat-card workspace-kpi-card" styles={{ body: { padding: "18px 20px" } }}>
            <Typography.Text type="secondary">Proyectos totales</Typography.Text>
            <Typography.Title level={2} style={{ margin: "6px 0 0", color: "#fbbf24" }}>
              {totals.projects}
            </Typography.Title>
          </Card>
          <Card className="stat-card workspace-kpi-card" styles={{ body: { padding: "18px 20px" } }}>
            <Typography.Text type="secondary">Miembros (suma)</Typography.Text>
            <Typography.Title level={2} style={{ margin: "6px 0 0", color: "#34d399" }}>
              {totals.members}
            </Typography.Title>
          </Card>
        </div>
      )}

      {loading ? (
        <Spin style={{ display: "block", margin: "48px auto" }} />
      ) : workspaces.length === 0 ? (
        <Empty description="Crea tu primer workspace" style={{ marginTop: 32 }}>
          <Button type="primary" className="btn-proyec" onClick={() => setModalOpen(true)}>Crear workspace</Button>
        </Empty>
      ) : (
        <div className="feature-grid">
          {workspaces.map((w) => (
            <Link key={w.id} to={`/app/proyecfer/workspaces/${w.id}`}>
              <FeatureCard
                emoji={w.icon ?? "📁"}
                title={w.name}
                meta={w.description || "Sin descripcion"}
              >
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <Tag icon={<FolderOutlined />} color="blue">{w.projectCount} proyectos</Tag>
                  <Tag icon={<TeamOutlined />} color="cyan">{w.memberCount} miembros</Tag>
                  <Tag color={ROLE_COLORS[w.myRole]}>{w.myRole}</Tag>
                </div>
              </FeatureCard>
            </Link>
          ))}
        </div>
      )}

      <Modal
        title="Nuevo workspace"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleCreate()}
        okText="Crear"
        okButtonProps={{ className: "btn-proyec" }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Mi equipo" />
          </Form.Item>
          <Form.Item name="description" label="Descripcion">
            <Input.TextArea rows={2} placeholder="Para que es este espacio?" />
          </Form.Item>
          <Form.Item name="icon" label="Icono (emoji)">
            <Input placeholder="🚀" maxLength={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
