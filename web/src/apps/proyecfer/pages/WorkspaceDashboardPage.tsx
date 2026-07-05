import { ActivityFeed } from "../components/ActivityFeed";
import { MemberManager } from "../components/MemberManager";
import { WorkspaceCharts } from "../components/WorkspaceCharts";
import { WorkspaceKpiGrid } from "../components/WorkspaceKpiGrid";
import { WorkspaceProjectGrid } from "../components/WorkspaceProjectGrid";
import { PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, Modal, Spin, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BackButton } from "../../../components/BackButton";
import { EditablePageHero } from "../../../components/EditablePageHero";
import {
  createCollabProject,
  fetchProyecFerStats,
  fetchWorkspace,
  fetchWorkspaceActivity,
  updateWorkspace,
} from "../../../api/proyecfer";
import type { ActivityItem, ProyecFerStats, WorkspaceDetail } from "../../../types/proyecfer";

export function WorkspaceDashboardPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [stats, setStats] = useState<ProyecFerStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [w, s, a] = await Promise.all([
        fetchWorkspace(workspaceId),
        fetchProyecFerStats(workspaceId),
        fetchWorkspaceActivity(workspaceId),
      ]);
      setWorkspace(w);
      setStats(s);
      setActivity(a);
    } catch {
      message.error("No se pudo cargar el workspace");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreateProject = async () => {
    if (!workspaceId) return;
    const values = await form.validateFields();
    try {
      await createCollabProject(workspaceId, values);
      message.success("Proyecto creado");
      setModalOpen(false);
      form.resetFields();
      await load();
    } catch {
      message.error("No se pudo crear el proyecto");
    }
  };

  if (!workspace) {
    return loading ? <Spin style={{ display: "block", margin: "80px auto" }} /> : null;
  }

  const canEdit = workspace.myRole === "OWNER" || workspace.myRole === "ADMIN" || workspace.myRole === "EDITOR";

  const handleSaveWorkspaceName = async (name: string) => {
    if (!workspaceId) return;
    try {
      await updateWorkspace(workspaceId, { name });
      setWorkspace((prev) => (prev ? { ...prev, name } : prev));
    } catch {
      message.error("No se pudo guardar el nombre");
    }
  };

  const handleSaveWorkspaceDescription = async (description: string) => {
    if (!workspaceId) return;
    try {
      await updateWorkspace(workspaceId, { description });
      setWorkspace((prev) => (prev ? { ...prev, description } : prev));
    } catch {
      message.error("No se pudo guardar la descripcion");
    }
  };

  return (
    <div className="workspace-dashboard">
      <BackButton to="/app/proyecfer/workspaces" label="Volver a workspaces" />
      <EditablePageHero
        variant="proyec"
        title={workspace.name}
        titlePrefix={<span style={{ marginRight: 8 }}>{workspace.icon ?? "📁"}</span>}
        subtitle={workspace.description ?? `${workspace.members.length} miembros · Rol: ${workspace.myRole}`}
        editable={canEdit}
        onSaveTitle={handleSaveWorkspaceName}
        onSaveSubtitle={handleSaveWorkspaceDescription}
        actions={
          canEdit ? (
            <Button type="primary" className="btn-proyec" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              Nuevo proyecto
            </Button>
          ) : undefined
        }
      />

      {stats && <WorkspaceKpiGrid stats={stats} />}

      <div className="workspace-dashboard__main split-layout split-layout--sidebar">
        <div className="workspace-dashboard__primary">
          {stats && (
            <>
              <WorkspaceProjectGrid workspaceId={workspaceId!} projects={stats.projects ?? []} />
              <WorkspaceCharts stats={stats} />
            </>
          )}
        </div>
        <aside className="workspace-dashboard__sidebar">
          <MemberManager workspace={workspace} onChanged={load} />
          <ActivityFeed items={activity} />
        </aside>
      </div>

      <Modal
        title="Nuevo proyecto"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleCreateProject()}
        okText="Crear"
        okButtonProps={{ className: "btn-proyec" }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Descripcion"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="color" label="Color" initialValue="#6366f1"><Input type="color" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
