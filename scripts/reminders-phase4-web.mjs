import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

fs.appendFileSync(path.join(root, "web/src/types.ts"), `

export type ReminderItem = {
  id: string;
  sourceType: "HABIT" | "TASK";
  sourceId: string;
  title: string;
  body: string | null;
  triggerAt: string;
  createdAt: string;
};
`, "utf8");

fs.appendFileSync(path.join(root, "web/src/api/client.ts"), `

import type { ReminderItem } from "../types";

export async function fetchReminders() {
  const { data } = await api.get<ReminderItem[]>("/reminders");
  return data;
}

export async function fetchReminderCount() {
  const { data } = await api.get<{ count: number }>("/reminders/count");
  return data.count;
}

export async function markReminderRead(id: string) {
  await api.post("/reminders/" + id + "/read");
}

export async function markAllRemindersRead() {
  await api.post("/reminders/read-all");
}
`, "utf8");

w("web/src/features/reminders/RemindersBell.tsx", `import { BellOutlined, CheckOutlined, FireOutlined, CheckSquareOutlined } from "@ant-design/icons";
import { Badge, Button, Drawer, Empty, List, Space, Typography, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchReminderCount, fetchReminders, markAllRemindersRead, markReminderRead } from "../../api/client";
import type { ReminderItem } from "../../types";

export function RemindersBell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      setCount(await fetchReminderCount());
    } catch {
      /* silencioso */
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchReminders());
      setCount(0);
      const c = await fetchReminderCount();
      setCount(c);
    } catch {
      message.error("No se pudieron cargar recordatorios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const id = window.setInterval(() => void refreshCount(), 60000);
    return () => window.clearInterval(id);
  }, [refreshCount]);

  const openDrawer = () => {
    setOpen(true);
    void loadItems();
  };

  const handleOpenItem = async (item: ReminderItem) => {
    try {
      await markReminderRead(item.id);
      setOpen(false);
      navigate(item.sourceType === "HABIT" ? "/app/habits/" + item.sourceId : "/app/tasks");
      void refreshCount();
    } catch {
      message.error("No se pudo marcar como leido");
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllRemindersRead();
      setItems([]);
      setCount(0);
      message.success("Recordatorios marcados como leidos");
    } catch {
      message.error("No se pudo actualizar");
    }
  };

  return (
    <>
      <Badge count={count} size="small" offset={[-2, 2]}>
        <Button type="text" icon={<BellOutlined style={{ fontSize: 20 }} />} onClick={openDrawer} aria-label="Recordatorios" />
      </Badge>

      <Drawer
        title="Recordatorios"
        placement="bottom"
        open={open}
        onClose={() => setOpen(false)}
        extra={
          items.length > 0 ? (
            <Button type="link" icon={<CheckOutlined />} onClick={() => void handleReadAll()}>
              Marcar todos
            </Button>
          ) : null
        }
      >
        {loading ? (
          <List loading dataSource={[]} />
        ) : items.length === 0 ? (
          <Empty description="Sin recordatorios pendientes" />
        ) : (
          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item style={{ cursor: "pointer" }} onClick={() => void handleOpenItem(item)}>
                <List.Item.Meta
                  avatar={item.sourceType === "HABIT" ? <FireOutlined style={{ color: "#22d3ee" }} /> : <CheckSquareOutlined style={{ color: "#38bdf8" }} />}
                  title={item.title}
                  description={
                    <Space direction="vertical" size={0}>
                      <Typography.Text type="secondary">{item.body}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(item.triggerAt).format("DD MMM HH:mm")}
                      </Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </>
  );
}
`);

const appShell = `import { Layout, Grid, Menu } from "antd";
import {
  CalendarOutlined,
  CheckSquareOutlined,
  FireOutlined,
  LineChartOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { RemindersBell } from "../features/reminders/RemindersBell";

const { Content, Sider } = Layout;
const { useBreakpoint } = Grid;

const navItems = [
  { key: "/app", icon: <CalendarOutlined />, label: "Hoy" },
  { key: "/app/habits", icon: <FireOutlined />, label: "Habitos" },
  { key: "/app/tasks", icon: <CheckSquareOutlined />, label: "Tareas" },
  { key: "/app/stats", icon: <LineChartOutlined />, label: "Stats" },
  { key: "/app/profile", icon: <UserOutlined />, label: "Perfil" },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const selectedKey = navItems.find((item) => location.pathname === item.key || location.pathname.startsWith(item.key + "/"))?.key ?? "/app";

  return (
    <Layout style={{ minHeight: "100dvh", background: "#0f172a" }}>
      {!isMobile && (
        <Sider width={220} style={{ borderRight: "1px solid #334155" }}>
          <div style={{ padding: "20px 16px", fontWeight: 700, fontSize: 20, color: "#22d3ee" }}>HabitFer</div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={navItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: "transparent", borderInlineEnd: 0 }}
          />
        </Sider>
      )}
      <Layout>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: isMobile ? "8px 16px 0" : "12px 24px 0",
            maxWidth: isMobile ? "100%" : 900,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <RemindersBell />
        </div>
        <Content
          style={{
            padding: isMobile ? "8px 16px 88px" : "8px 24px 24px",
            maxWidth: isMobile ? "100%" : 900,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <Outlet />
        </Content>
        {isMobile && (
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              borderTop: "1px solid #334155",
              background: "#1e293b",
              paddingBottom: "env(safe-area-inset-bottom)",
              zIndex: 100,
            }}
          >
            <Menu
              mode="horizontal"
              selectedKeys={[selectedKey]}
              items={navItems}
              onClick={({ key }) => navigate(key)}
              style={{ justifyContent: "space-around", background: "transparent", borderBottom: 0, lineHeight: "56px" }}
            />
          </div>
        )}
      </Layout>
    </Layout>
  );
}
`;
w("web/src/layouts/AppShell.tsx", appShell);

const taskForm = fs.readFileSync(path.join(root, "web/src/features/tasks/TaskForm.tsx"), "utf8");
const updatedTaskForm = taskForm
  .replace('import { DatePicker, Form, Input, Select } from "antd";', 'import { DatePicker, Form, Input, Select, Switch } from "antd";')
  .replace("  dueTime?: dayjs.Dayjs | null;\n};", "  dueTime?: dayjs.Dayjs | null;\n  reminderEnabled: boolean;\n};")
  .replace("    dueTime: task?.dueTime ? dayjs(task.dueTime, \"HH:mm\") : null,\n  };", "    dueTime: task?.dueTime ? dayjs(task.dueTime, \"HH:mm\") : null,\n    reminderEnabled: task?.reminderEnabled ?? false,\n  };")
  .replace("    dueTime: values.dueTime ? values.dueTime.format(\"HH:mm\") : null,\n  };", "    dueTime: values.dueTime ? values.dueTime.format(\"HH:mm\") : null,\n    reminderEnabled: values.reminderEnabled,\n  };")
  .replace(
    `      <Form.Item name="dueTime" label="Hora (opcional)">
        <DatePicker.TimePicker size="large" style={{ width: "100%" }} format="HH:mm" />
      </Form.Item>
    </Form>`,
    `      <Form.Item name="dueTime" label="Hora (opcional)">
        <DatePicker.TimePicker size="large" style={{ width: "100%" }} format="HH:mm" />
      </Form.Item>
      <Form.Item name="reminderEnabled" label="Recordatorio" valuePropName="checked" extra="Te avisara a la hora de la fecha limite">
        <Switch />
      </Form.Item>
    </Form>`
  );
fs.writeFileSync(path.join(root, "web/src/features/tasks/TaskForm.tsx"), updatedTaskForm, "utf8");

console.log("reminders web ok");
