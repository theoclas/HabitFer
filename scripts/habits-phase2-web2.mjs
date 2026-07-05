import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

w("web/src/features/habits/HabitCheckItem.tsx", `import { CheckCircleFilled, CheckCircleOutlined, FireOutlined } from "@ant-design/icons";
import { List, Space, Tag, Typography } from "antd";
import type { Habit, HabitToday } from "../../types";

type Props = {
  habit: Habit | HabitToday;
  loading?: boolean;
  onToggle: (habit: Habit | HabitToday) => void;
  onOpen?: (habit: Habit | HabitToday) => void;
};

export function HabitCheckItem({ habit, loading, onToggle, onOpen }: Props) {
  const completed = habit.completedToday;

  return (
    <List.Item
      style={{
        padding: "14px 12px",
        marginBottom: 8,
        borderRadius: 12,
        background: "#1e293b",
        border: "1px solid #334155",
      }}
      onClick={() => onOpen?.(habit)}
    >
      <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 12 }}>
        <button
          type="button"
          aria-label={completed ? "Marcar pendiente" : "Marcar completado"}
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(habit);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 28,
            lineHeight: 1,
            cursor: loading ? "wait" : "pointer",
            color: completed ? habit.color : "#64748b",
          }}
        >
          {completed ? <CheckCircleFilled /> : <CheckCircleOutlined />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text strong style={{ color: completed ? "#94a3b8" : "#f1f5f9", textDecoration: completed ? "line-through" : "none" }}>
            {habit.title}
          </Typography.Text>
          {habit.streakEnabled && habit.currentStreak > 0 && (
            <div style={{ marginTop: 4 }}>
              <Tag icon={<FireOutlined />} color="volcano">{habit.currentStreak} dias</Tag>
            </div>
          )}
        </div>
        <div style={{ width: 8, height: 40, borderRadius: 4, background: habit.color }} />
      </div>
    </List.Item>
  );
}
`);

w("web/src/pages/HabitsPage.tsx", `import { PlusOutlined } from "@ant-design/icons";
import { Button, Drawer, Empty, Form, List, Modal, Typography, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeHabit, createHabit, deleteHabit, fetchHabits, uncompleteHabit, updateHabit } from "../api/client";
import { HabitCheckItem } from "../features/habits/HabitCheckItem";
import { HabitForm, formValuesToPayload, habitToFormValues, type HabitFormValues } from "../features/habits/HabitForm";
import type { Habit } from "../types";
import dayjs from "dayjs";

export function HabitsPage() {
  const navigate = useNavigate();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<HabitFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHabits(await fetchHabits());
    } catch {
      message.error("No se pudieron cargar los habitos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const todayKey = dayjs().format("YYYY-MM-DD");

  const handleToggle = async (habit: Habit) => {
    setTogglingId(habit.id);
    try {
      if (habit.completedToday) {
        await uncompleteHabit(habit.id, todayKey);
      } else {
        await completeHabit(habit.id);
      }
      await load();
    } catch {
      message.error("No se pudo actualizar el habito");
    } finally {
      setTogglingId(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue(habitToFormValues());
    setDrawerOpen(true);
  };

  const openEdit = (habit: Habit) => {
    setEditing(habit);
    form.setFieldsValue(habitToFormValues(habit));
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = formValuesToPayload(values);
      if (editing) {
        await updateHabit(editing.id, payload);
        message.success("Habito actualizado");
      } else {
        await createHabit(payload);
        message.success("Habito creado");
      }
      setDrawerOpen(false);
      await load();
    } catch {
      message.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = (habit: Habit) => {
    Modal.confirm({
      title: "Archivar habito?",
      content: "Podras verlo mas adelante en archivados.",
      okText: "Archivar",
      cancelText: "Cancelar",
      onOk: async () => {
        await updateHabit(habit.id, { archived: true });
        message.success("Habito archivado");
        await load();
      },
    });
  };

  const scheduled = habits.filter((h) => h.scheduledToday);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>Habitos</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nuevo</Button>
      </div>

      {loading ? (
        <List loading dataSource={[]} />
      ) : habits.length === 0 ? (
        <Empty description="Crea tu primer habito">
          <Button type="primary" onClick={openCreate}>Crear habito</Button>
        </Empty>
      ) : (
        <>
          <Typography.Title level={5} type="secondary">Hoy ({scheduled.length})</Typography.Title>
          <List
            dataSource={scheduled}
            locale={{ emptyText: "Nada programado para hoy" }}
            renderItem={(habit) => (
              <HabitCheckItem
                habit={habit}
                loading={togglingId === habit.id}
                onToggle={handleToggle}
                onOpen={() => navigate("/app/habits/" + habit.id)}
              />
            )}
          />
          <Typography.Title level={5} type="secondary" style={{ marginTop: 24 }}>Todos</Typography.Title>
          <List
            dataSource={habits}
            renderItem={(habit) => (
              <HabitCheckItem
                habit={habit}
                loading={togglingId === habit.id}
                onToggle={handleToggle}
                onOpen={() => openEdit(habit)}
              />
            )}
          />
        </>
      )}

      <Drawer
        title={editing ? "Editar habito" : "Nuevo habito"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        height="auto"
        placement="bottom"
        styles={{ body: { paddingBottom: 24 } }}
        extra={
          <Button type="primary" loading={saving} onClick={() => void handleSave()}>
            Guardar
          </Button>
        }
      >
        <HabitForm form={form} initial={editing} />
        {editing && (
          <Button danger block style={{ marginTop: 16 }} onClick={() => handleArchive(editing)}>
            Archivar
          </Button>
        )}
      </Drawer>
    </div>
  );
}
`);

w("web/src/pages/HabitDetailPage.tsx", `import { ArrowLeftOutlined, FireOutlined } from "@ant-design/icons";
import { Button, Card, Empty, List, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { completeHabit, fetchHabit, uncompleteHabit } from "../api/client";
import { HabitCheckItem } from "../features/habits/HabitCheckItem";
import type { Habit } from "../types";

export function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setHabit(await fetchHabit(id));
    } catch {
      message.error("Habito no encontrado");
      navigate("/app/habits");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { void load(); }, [load]);

  const todayKey = dayjs().format("YYYY-MM-DD");

  const handleToggle = async () => {
    if (!habit) return;
    setToggling(true);
    try {
      if (habit.completedToday) {
        setHabit(await uncompleteHabit(habit.id, todayKey));
      } else {
        setHabit(await completeHabit(habit.id));
      }
    } catch {
      message.error("No se pudo actualizar");
    } finally {
      setToggling(false);
    }
  };

  if (!habit && loading) return <Card loading />;

  if (!habit) return null;

  return (
    <div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/app/habits")} style={{ marginBottom: 8 }}>
        Volver
      </Button>
      <Typography.Title level={2}>{habit.title}</Typography.Title>
      {habit.description && <Typography.Paragraph type="secondary">{habit.description}</Typography.Paragraph>}

      <Space wrap style={{ marginBottom: 16 }}>
        {habit.streakEnabled && <Tag icon={<FireOutlined />} color="volcano">Racha: {habit.currentStreak}</Tag>}
        {habit.streakEnabled && <Tag>Mejor: {habit.longestStreak}</Tag>}
        <Tag>{habit.scheduleType === "DAILY" ? "Diario" : "Semanal"}</Tag>
      </Space>

      {habit.scheduledToday && (
        <HabitCheckItem habit={habit} loading={toggling} onToggle={handleToggle} />
      )}

      <Card title="Ultimos 90 dias" style={{ marginTop: 16 }}>
        {habit.recentCompletions?.length ? (
          <List
            size="small"
            dataSource={habit.recentCompletions}
            renderItem={(d) => <List.Item>{dayjs(d).format("DD MMM YYYY")}</List.Item>}
          />
        ) : (
          <Empty description="Sin completados aun" />
        )}
      </Card>
    </div>
  );
}
`);

w("web/src/pages/TodayPage.tsx", `import { Card, Empty, List, Typography, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeHabit, fetchHabitsToday, uncompleteHabit } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { HabitCheckItem } from "../features/habits/HabitCheckItem";
import type { HabitToday } from "../types";

export function TodayPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [habits, setHabits] = useState<HabitToday[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHabits(await fetchHabitsToday());
    } catch {
      message.error("No se pudo cargar el resumen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const todayKey = dayjs().format("YYYY-MM-DD");
  const done = habits.filter((h) => h.completedToday).length;

  const handleToggle = async (habit: HabitToday) => {
    setTogglingId(habit.id);
    try {
      if (habit.completedToday) {
        await uncompleteHabit(habit.id, todayKey);
      } else {
        await completeHabit(habit.id);
      }
      await load();
    } catch {
      message.error("No se pudo actualizar");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div>
      <Typography.Title level={2}>Hola, {user?.fullName?.split(" ")[0] ?? "amigo"}</Typography.Title>
      <Typography.Paragraph type="secondary">
        {dayjs().format("dddd, D MMMM")} · {done}/{habits.length} habitos
      </Typography.Paragraph>

      <Card title="Habitos de hoy" styles={{ body: { padding: habits.length ? 12 : 24 } }}>
        {loading ? (
          <List loading dataSource={[]} />
        ) : habits.length === 0 ? (
          <Empty description="No tienes habitos para hoy" />
        ) : (
          <List
            dataSource={habits}
            renderItem={(habit) => (
              <HabitCheckItem
                habit={habit}
                loading={togglingId === habit.id}
                onToggle={handleToggle}
                onOpen={() => navigate("/app/habits/" + habit.id)}
              />
            )}
          />
        )}
      </Card>

      <Card title="Tareas de hoy" style={{ marginTop: 16 }}>
        <Empty description="Proximamente" />
      </Card>
    </div>
  );
}
`);

let router = fs.readFileSync(path.join(root, "web/src/router.tsx"), "utf8");
router = router.replace(
  'import { HabitsPage } from "./pages/HabitsPage";',
  'import { HabitDetailPage } from "./pages/HabitDetailPage";\nimport { HabitsPage } from "./pages/HabitsPage";'
);
router = router.replace(
  '<Route path="habits" element={<HabitsPage />} />',
  '<Route path="habits" element={<HabitsPage />} />\n          <Route path="habits/:id" element={<HabitDetailPage />} />'
);
fs.writeFileSync(path.join(root, "web/src/router.tsx"), router, "utf8");

console.log("habits pages ok");
