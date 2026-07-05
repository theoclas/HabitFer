import { BellOutlined, CheckOutlined, FireOutlined, CheckSquareOutlined } from "@ant-design/icons";
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
      navigate(item.sourceType === "HABIT" ? "/app/habitfer/habits/" + item.sourceId : "/app/habitfer/tasks");
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
