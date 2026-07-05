import { FolderAddOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Form, Input, List, Segmented, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createProject,
  createTask,
  fetchProjects,
  fetchTasks,
  updateTask,
} from "../api/client";
import { FormDrawer } from "../components/FormDrawer";
import { TaskForm, formValuesToPayload, taskToFormValues, type TaskFormValues } from "../features/tasks/TaskForm";
import { TaskItem } from "../features/tasks/TaskItem";
import { useIsMobile } from "../hooks/useIsMobile";
import type { Project, Task, TaskStatus } from "../types";

export function TasksPage() {
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "open">("open");
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [taskDrawer, setTaskDrawer] = useState(false);
  const [projectDrawer, setProjectDrawer] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [form] = Form.useForm<TaskFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        fetchProjects(),
        fetchTasks({
          projectId: filter === "all" ? undefined : filter === "inbox" ? "inbox" : filter,
          status: statusFilter === "open" ? undefined : statusFilter,
        }),
      ]);
      setProjects(p);
      setTasks(statusFilter === "open" ? t.filter((x) => x.status !== "DONE") : t);
    } catch {
      message.error("No se pudieron cargar las tareas");
    } finally {
      setLoading(false);
    }
  }, [filter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const segmentOptions = useMemo(
    () => [
      { label: "Todas", value: "all" },
      { label: "Inbox", value: "inbox" },
      ...projects.map((p) => ({ label: p.name, value: p.id })),
    ],
    [projects],
  );

  const statusOptions = [
    { label: "Abiertas", value: "open" },
    { label: "Pendientes", value: "TODO" },
    { label: "En progreso", value: "IN_PROGRESS" },
    { label: "Hechas", value: "DONE" },
  ];

  const handleToggle = async (task: Task) => {
    setTogglingId(task.id);
    try {
      const next: TaskStatus = task.status === "DONE" ? "TODO" : "DONE";
      await updateTask(task.id, { status: next });
      await load();
    } catch {
      message.error("No se pudo actualizar");
    } finally {
      setTogglingId(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue(taskToFormValues(null, filter === "all" || filter === "inbox" ? null : filter));
    setTaskDrawer(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    form.setFieldsValue(taskToFormValues(task));
    setTaskDrawer(true);
  };

  const handleSaveTask = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = formValuesToPayload(values);
      if (editing) {
        await updateTask(editing.id, payload);
        message.success("Tarea actualizada");
      } else {
        await createTask(payload);
        message.success("Tarea creada");
      }
      setTaskDrawer(false);
      await load();
    } catch {
      message.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      await createProject({ name: newProjectName.trim() });
      setNewProjectName("");
      setProjectDrawer(false);
      message.success("Proyecto creado");
      await load();
    } catch {
      message.error("No se pudo crear el proyecto");
    }
  };

  const filtersPanel = (
    <>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12, fontWeight: 600 }}>
        Proyecto
      </Typography.Text>
      <Segmented
        block={isMobile}
        value={filter}
        onChange={(v) => setFilter(String(v))}
        options={segmentOptions}
        style={{ marginBottom: 20, width: "100%" }}
      />
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12, fontWeight: 600 }}>
        Estado
      </Typography.Text>
      <Segmented
        block={isMobile}
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as TaskStatus | "open")}
        options={statusOptions}
        style={{ width: "100%" }}
      />
    </>
  );

  return (
    <div>
      <div className="page-header">
        {isMobile && <Typography.Title level={2} className="page-header__title" style={{ margin: 0 }}>Tareas</Typography.Title>}
        {!isMobile && <Typography.Text type="secondary">{tasks.length} tareas en la vista actual</Typography.Text>}
        <div className="page-header__actions">
          <Button icon={<FolderAddOutlined />} onClick={() => setProjectDrawer(true)}>Proyecto</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nueva</Button>
        </div>
      </div>

      <div className="tasks-layout">
        <aside className={isMobile ? undefined : "tasks-layout__filters"}>
          {isMobile ? (
            <>
              <Segmented block value={filter} onChange={(v) => setFilter(String(v))} options={segmentOptions} style={{ marginBottom: 12 }} />
              <Segmented block value={statusFilter} onChange={(v) => setStatusFilter(v as TaskStatus | "open")} options={statusOptions} style={{ marginBottom: 16 }} />
            </>
          ) : (
            filtersPanel
          )}
        </aside>

        <section>
          {loading ? (
            <List loading dataSource={[]} />
          ) : tasks.length === 0 ? (
            <Empty description="Sin tareas">
              <Button type="primary" onClick={openCreate}>Crear tarea</Button>
            </Empty>
          ) : (
            <List
              dataSource={tasks}
              renderItem={(task) => (
                <TaskItem task={task} loading={togglingId === task.id} onToggle={handleToggle} onOpen={openEdit} />
              )}
            />
          )}
        </section>
      </div>

      <FormDrawer
        title={editing ? "Editar tarea" : "Nueva tarea"}
        open={taskDrawer}
        onClose={() => setTaskDrawer(false)}
        extra={<Button type="primary" loading={saving} onClick={() => void handleSaveTask()}>Guardar</Button>}
      >
        <TaskForm form={form} projects={projects} initial={editing} />
      </FormDrawer>

      <FormDrawer title="Nuevo proyecto" open={projectDrawer} onClose={() => setProjectDrawer(false)}>
        <Input
          size="large"
          placeholder="Nombre del proyecto"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onPressEnter={() => void handleCreateProject()}
        />
        <Button type="primary" block size="large" style={{ marginTop: 16 }} onClick={() => void handleCreateProject()}>
          Crear proyecto
        </Button>
      </FormDrawer>
    </div>
  );
}
