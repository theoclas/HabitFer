import { BookOutlined, FileTextOutlined, LineChartOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Form, Input, Modal, Select, Tabs, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../../components/BackButton";
import { EditablePageHero } from "../../../components/EditablePageHero";
import { InlineEditableText } from "../../../components/InlineEditableText";
import { FormDrawer } from "../../../components/FormDrawer";
import { useAuth } from "../../../contexts/AuthContext";
import {
  createCollabTask,
  createPage,
  createWorkGuide,
  fetchCollabProject,
  updateCollabProject,
  updateCollabTask,
} from "../../../api/proyecfer";
import { CommentPanel } from "../components/CommentPanel";
import { CollabTaskForm, formValuesToCollabTaskPayload } from "../components/CollabTaskForm";
import { ProjectComplianceTab } from "../components/compliance/ProjectComplianceTab";
import type { CollabProjectDetail, CollabTask, WorkGuideSummary } from "../../../types/proyecfer";

const STATUS_LABELS: Record<string, string> = {
  TODO: "Pendiente",
  IN_PROGRESS: "En progreso",
  DONE: "Hecha",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "default",
  MEDIUM: "blue",
  HIGH: "red",
};

export function CollabProjectPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<CollabProjectDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [guideForm] = Form.useForm();

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setProject(await fetchCollabProject(projectId));
    } catch {
      message.error("No se pudo cargar el proyecto");
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreateTask = async () => {
    if (!projectId) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await createCollabTask(projectId, formValuesToCollabTaskPayload(values));
      message.success("Tarea creada");
      setDrawerOpen(false);
      form.resetFields();
      await load();
    } catch {
      message.error("No se pudo crear");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateGuide = async () => {
    if (!projectId) return;
    const values = await guideForm.validateFields();
    try {
      const guide = await createWorkGuide(projectId, values);
      message.success("Guia creada");
      setGuideModalOpen(false);
      guideForm.resetFields();
      navigate(`/app/proyecfer/workspaces/${workspaceId}/projects/${projectId}/guides/${guide.id}`);
    } catch {
      message.error("No se pudo crear la guia");
    }
  };

  const handleStatusChange = async (task: CollabTask, status: CollabTask["status"]) => {
    try {
      await updateCollabTask(task.id, { status });
      await load();
    } catch {
      message.error("No se pudo actualizar");
    }
  };

  const handleTaskTitleSave = async (task: CollabTask, title: string) => {
    try {
      await updateCollabTask(task.id, { title });
      setProject((prev) =>
        prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, title } : t)) } : prev,
      );
    } catch {
      message.error("No se pudo renombrar la tarea");
    }
  };

  const handleSaveProjectName = async (name: string) => {
    if (!projectId) return;
    try {
      await updateCollabProject(projectId, { name });
      setProject((prev) => (prev ? { ...prev, name } : prev));
    } catch {
      message.error("No se pudo guardar el nombre");
    }
  };

  const handleSaveProjectDescription = async (description: string) => {
    if (!projectId) return;
    try {
      await updateCollabProject(projectId, { description });
      setProject((prev) => (prev ? { ...prev, description } : prev));
    } catch {
      message.error("No se pudo guardar la descripcion");
    }
  };

  if (!project) return null;

  const myRole = project.members?.find((m) => m.user.id === user?.id)?.role;
  const canEdit = !myRole || myRole !== "VIEWER";

  const members = project.members?.map((m) => m.user) ?? [];
  const guides: WorkGuideSummary[] = (project.workGuides ?? []).map((g) => ({
    ...g,
    stepCount: g._count?.steps ?? g.stepCount ?? 0,
  }));

  const dailyTemplates = project.dailyTemplates ?? [];
  const taskList = project.tasks;

  const openCreateTask = (kind: "ONE_OFF" | "DAILY" = "ONE_OFF") => {
    form.setFieldsValue({ kind, status: "TODO", priority: "MEDIUM", dueDate: undefined });
    setDrawerOpen(true);
  };

  const tabItems = [
    {
      key: "guides",
      label: (
        <span>
          <BookOutlined /> Guias ({guides.length})
        </span>
      ),
      children: (
        <div>
          <div className="page-header">
            <Typography.Paragraph type="secondary" style={{ margin: 0, maxWidth: 520 }}>
              Documenta procesos paso a paso para tu equipo: onboarding, procedimientos, checklists operativos.
            </Typography.Paragraph>
            <Button type="primary" className="btn-proyec" icon={<PlusOutlined />} onClick={() => setGuideModalOpen(true)}>
              Nueva guia
            </Button>
          </div>
          {guides.length === 0 ? (
            <Empty description="Sin guias de trabajo">
              <Button type="primary" className="btn-proyec" icon={<PlusOutlined />} onClick={() => setGuideModalOpen(true)}>
                Crear primera guia
              </Button>
            </Empty>
          ) : (
            <div className="feature-grid">
              {guides.map((g) => (
                <Link
                  key={g.id}
                  to={`/app/proyecfer/workspaces/${workspaceId}/projects/${projectId}/guides/${g.id}`}
                >
                  <Card hoverable className="guide-card" styles={{ body: { padding: "20px 22px" } }}>
                    <div style={{ fontSize: "2rem", marginBottom: 10 }}>{g.icon ?? "📋"}</div>
                    <div className="feature-card__title">{g.title}</div>
                    <div className="feature-card__meta" style={{ marginTop: 6 }}>
                      {g.description || "Proceso documentado"}
                    </div>
                    <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="guide-card__steps-badge">{g.stepCount ?? 0} pasos</span>
                      {g.category && <Tag>{g.category}</Tag>}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "tasks",
      label: `Tareas (${taskList.length})`,
      children: (
        <div>
          <div className="page-header">
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700 }}>Tareas</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button icon={<PlusOutlined />} onClick={() => openCreateTask("DAILY")}>
                Programar diaria
              </Button>
              <Button type="primary" className="btn-proyec" icon={<PlusOutlined />} onClick={() => openCreateTask("ONE_OFF")}>
                Nueva tarea
              </Button>
            </div>
          </div>

          {dailyTemplates.length > 0 && (
            <div className="daily-templates-bar">
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Rutinas activas — se genera una tarea pendiente cada dia:
              </Typography.Text>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {dailyTemplates.map((t) => (
                  <Tag key={t.id} color="purple">
                    {t.title}
                    {t.assignee ? ` · ${t.assignee.fullName}` : ""}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {taskList.length === 0 ? (
            <Empty description="Sin tareas. Programa una rutina diaria o crea una tarea unica." />
          ) : (
            taskList.map((task) => (
              <Card
                key={task.id}
                size="small"
                className={`task-card ${task.status === "DONE" ? "task-card--done" : ""}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {task.sourceDailyId ? (
                      <Typography.Text strong>{task.title}</Typography.Text>
                    ) : (
                      <InlineEditableText
                        value={task.title}
                        strong
                        editable={canEdit}
                        onSave={(title) => handleTaskTitleSave(task, title)}
                      />
                    )}
                    {task.description && (
                      <div><Typography.Text type="secondary">{task.description}</Typography.Text></div>
                    )}
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {task.sourceDailyId && <Tag color="purple">Rutina diaria</Tag>}
                      {task.assignee && <Tag color="geekblue">{task.assignee.fullName}</Tag>}
                      <Tag color={PRIORITY_COLORS[task.priority]}>{task.priority}</Tag>
                      <Tag>{STATUS_LABELS[task.status]}</Tag>
                    </div>
                  </div>
                  <Select
                    size="small"
                    value={task.status}
                    disabled={!canEdit}
                    onChange={(v) => void handleStatusChange(task, v)}
                    style={{ minWidth: 130 }}
                    options={[
                      { value: "TODO", label: "Pendiente" },
                      { value: "IN_PROGRESS", label: "En progreso" },
                      { value: "DONE", label: "Hecha" },
                    ]}
                  />
                </div>
              </Card>
            ))
          )}
        </div>
      ),
    },
    {
      key: "compliance",
      label: (
        <span>
          <LineChartOutlined /> Cumplimiento{dailyTemplates.length > 0 ? ` (${dailyTemplates.length})` : ""}
        </span>
      ),
      children: projectId ? (
        <ProjectComplianceTab
          projectId={projectId}
          members={members}
          canEdit={canEdit}
          onCreateRoutine={() => openCreateTask("DAILY")}
        />
      ) : null,
    },
    {
      key: "pages",
      label: (
        <span>
          <FileTextOutlined /> Paginas ({project.pages.length})
        </span>
      ),
      children: (
        <div>
          {project.pages.map((p) => (
            <Link key={p.id} to={`/app/proyecfer/workspaces/${workspaceId}/pages/${p.id}`}>
              <Card size="small" hoverable className="feature-card" style={{ marginBottom: 8 }}>
                {p.icon ?? "📄"} {p.title}
              </Card>
            </Link>
          ))}
          <Button
            style={{ marginTop: 8 }}
            icon={<PlusOutlined />}
            onClick={async () => {
              if (!workspaceId || !projectId) return;
              const page = await createPage({ workspaceId, projectId, title: "Nueva pagina" });
              navigate(`/app/proyecfer/workspaces/${workspaceId}/pages/${page.id}`);
            }}
          >
            Nueva pagina
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {workspaceId && (
        <BackButton
          to={`/app/proyecfer/workspaces/${workspaceId}`}
          label="Volver al workspace"
        />
      )}
      <EditablePageHero
        variant="proyec"
        accentColor={project.color}
        title={project.name}
        subtitle={project.description ?? "Proyecto colaborativo"}
        editable={canEdit}
        onSaveTitle={handleSaveProjectName}
        onSaveSubtitle={handleSaveProjectDescription}
      />

      <div className="split-layout split-layout--sidebar">
        <Tabs defaultActiveKey="guides" items={tabItems} className="project-tabs" />
        <CommentPanel targetType="COLLAB_PROJECT" targetId={project.id} />
      </div>

      <FormDrawer
        title="Nueva tarea"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Button type="primary" className="btn-proyec" loading={saving} onClick={() => void handleCreateTask()}>Crear</Button>}
      >
        <CollabTaskForm form={form} members={members} />
      </FormDrawer>

      <Modal
        title="Nueva guia de trabajo"
        open={guideModalOpen}
        onCancel={() => setGuideModalOpen(false)}
        onOk={() => void handleCreateGuide()}
        okText="Crear guia"
        okButtonProps={{ className: "btn-proyec" }}
      >
        <Form form={guideForm} layout="vertical">
          <Form.Item name="title" label="Nombre del proceso" rules={[{ required: true }]}>
            <Input placeholder="Ej: Onboarding de nuevo miembro" />
          </Form.Item>
          <Form.Item name="description" label="Descripcion">
            <Input.TextArea rows={2} placeholder="Para que sirve esta guia?" />
          </Form.Item>
          <Form.Item name="category" label="Carpeta / categoria">
            <Input placeholder="Ej: Operaciones, RRHH, Desarrollo" />
          </Form.Item>
          <Form.Item name="icon" label="Icono" initialValue="📋">
            <Input maxLength={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
