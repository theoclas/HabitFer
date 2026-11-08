import { AppstoreOutlined, FolderAddOutlined, PlusOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Button, Form, Input, Segmented, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createProject, createTask, fetchProjects, fetchTasks, updateTask } from "../api/client";
import { buzz, playTick } from "../apps/habitfer/effects";
import { apiErrorMessage } from "../apps/habitfer/format";
import { FormDrawer } from "../components/FormDrawer";
import { QuickCapture } from "../features/tasks/QuickCapture";
import { TaskBoard } from "../features/tasks/TaskBoard";
import { TaskCard } from "../features/tasks/TaskCard";
import { TaskForm, formValuesToPayload, taskToFormValues, type TaskFormValues } from "../features/tasks/TaskForm";
import { useIsMobile } from "../hooks/useIsMobile";
import type { Project, Task, TaskStatus } from "../types";

type View = "list" | "board";
type StatusFilter = "open" | "DONE" | "all";

const VIEW_KEY = "hf_tasks_view";
/** En el tablero, las hechas de las ultimas dos semanas (las viejas solo en la lista). */
const BOARD_DONE_DAYS = 14;
const PRIORITY_RANK: Record<Task["priority"], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list";
  } catch {
    return "list";
  }
}

/** Vencidas primero, luego por fecha (sin fecha al final), prioridad y lo mas nuevo. */
function sortTasks(a: Task, b: Task): number {
  const doneA = a.status === "DONE" ? 1 : 0;
  const doneB = b.status === "DONE" ? 1 : 0;
  if (doneA !== doneB) return doneA - doneB;
  // Hechas: lo último que terminaste, arriba.
  if (doneA && doneB) return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  const da = a.dueDate ? `${a.dueDate} ${a.dueTime ?? "99:99"}` : "9999";
  const db = b.dueDate ? `${b.dueDate} ${b.dueTime ?? "99:99"}` : "9999";
  if (da !== db) return da < db ? -1 : 1;
  if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  return b.createdAt.localeCompare(a.createdAt);
}

export function TasksPage() {
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [view, setView] = useState<View>(readView);
  const [loading, setLoading] = useState(true);
  const [taskDrawer, setTaskDrawer] = useState(false);
  const [projectDrawer, setProjectDrawer] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [form] = Form.useForm<TaskFormValues>();

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const [p, t] = await Promise.all([
          fetchProjects(),
          fetchTasks({ projectId: project === "all" ? undefined : project === "inbox" ? "inbox" : project }),
        ]);
        setProjects(p);
        setTasks(t);
      } catch {
        if (!opts?.silent) message.error("No se pudieron cargar las tareas");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [project],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* sin almacenamiento */
    }
  };

  const listTasks = useMemo(
    () =>
      tasks
        .filter((t) => (statusFilter === "open" ? t.status !== "DONE" : statusFilter === "DONE" ? t.status === "DONE" : true))
        .sort(sortTasks),
    [tasks, statusFilter],
  );
  const boardTasks = useMemo(() => {
    const since = dayjs().subtract(BOARD_DONE_DAYS, "day");
    return tasks.filter((t) => t.status !== "DONE" || dayjs(t.updatedAt).isAfter(since)).sort(sortTasks);
  }, [tasks]);
  const openCount = tasks.filter((t) => t.status !== "DONE").length;
  const todayCount = tasks.filter((t) => t.status !== "DONE" && (t.dueToday || t.overdue)).length;

  /** Cambio de estado al instante; si falla, vuelve como estaba. */
  const changeStatus = async (task: Task, to: TaskStatus) => {
    const before = tasks;
    if (to === "DONE") {
      buzz();
      playTick();
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: to, overdue: to === "DONE" ? false : t.overdue, updatedAt: new Date().toISOString() } : t)));
    try {
      await updateTask(task.id, { status: to });
    } catch (err) {
      setTasks(before);
      message.error(apiErrorMessage(err, "No se pudo actualizar la tarea, la dejé como estaba"));
    }
  };
  const toggle = (task: Task) => void changeStatus(task, task.status === "DONE" ? "TODO" : "DONE");

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue(taskToFormValues(null, project === "all" || project === "inbox" ? null : project));
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
      await load({ silent: true });
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
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
      await load({ silent: true });
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo crear el proyecto"));
    }
  };

  const projectChips = [
    { value: "all", label: "Todas" },
    { value: "inbox", label: "Sin proyecto" },
    ...projects.map((p) => ({ value: p.id, label: p.name, color: p.color })),
  ];

  return (
    <div style={{ maxWidth: view === "board" ? 1200 : 860 }}>
      <div className="hf-page-head">
        <div>
          <div className="hf-kicker">
            {openCount} {openCount === 1 ? "abierta" : "abiertas"} · {todayCount} para hoy
          </div>
          <h1 className="hf-title hf-title--sm">Tareas</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Segmented
            value={view}
            onChange={(v) => changeView(v as View)}
            options={[
              { value: "list", icon: <UnorderedListOutlined />, label: isMobile ? undefined : "Lista" },
              { value: "board", icon: <AppstoreOutlined />, label: isMobile ? undefined : "Tablero" },
            ]}
            aria-label="Vista de tareas"
          />
          {!isMobile && (
            <>
              <Button icon={<FolderAddOutlined />} onClick={() => setProjectDrawer(true)}>
                Proyecto
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Nueva
              </Button>
            </>
          )}
        </div>
      </div>

      <QuickCapture
        projects={projects}
        defaultProjectId={project === "all" || project === "inbox" ? null : project}
        onCreated={(task) => setTasks((prev) => [task, ...prev])}
      />

      <div className="hf-chips-scroll" role="group" aria-label="Proyecto">
        {projectChips.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`hf-chip${project === c.value ? " is-on" : ""}`}
            onClick={() => setProject(c.value)}
            aria-pressed={project === c.value}
          >
            {"color" in c && <i style={{ background: c.color }} aria-hidden="true" />}
            {c.label}
          </button>
        ))}
        {isMobile && (
          <button type="button" className="hf-chip" onClick={() => setProjectDrawer(true)}>
            + Proyecto
          </button>
        )}
      </div>

      {view === "list" && (
        <Segmented
          block={isMobile}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={[
            { value: "open", label: "Abiertas" },
            { value: "DONE", label: "Hechas" },
            { value: "all", label: "Todas" },
          ]}
          style={{ marginBottom: 14 }}
        />
      )}

      {loading ? (
        <div className="hf-list" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="hf-skel" style={{ height: 64 }} />
          ))}
        </div>
      ) : view === "board" ? (
        <TaskBoard tasks={boardTasks} onStatus={(t, to) => void changeStatus(t, to)} onToggle={toggle} onOpen={openEdit} />
      ) : listTasks.length === 0 ? (
        <div className="hf-empty">
          <b>{statusFilter === "DONE" ? "Todavía no hay tareas hechas" : "Sin tareas pendientes"}</b>
          <p style={{ margin: "0 0 16px" }}>Escríbela arriba como te salga: «mañana 3pm llamar a Juan».</p>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Crear con formulario
          </Button>
        </div>
      ) : (
        <div className="hf-task-list">
          {listTasks.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={toggle} onOpen={openEdit} />
          ))}
        </div>
      )}

      <FormDrawer
        title={editing ? "Editar tarea" : "Nueva tarea"}
        open={taskDrawer}
        onClose={() => setTaskDrawer(false)}
        extra={
          <Button type="primary" loading={saving} onClick={() => void handleSaveTask()}>
            Guardar
          </Button>
        }
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
