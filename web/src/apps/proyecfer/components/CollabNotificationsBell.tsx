import { BellOutlined } from "@ant-design/icons";
import { Badge, Button, List, Popover, Typography, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import {
  fetchCollabNotifications,
  markAllCollabNotificationsRead,
  markCollabNotificationRead,
} from "../../../api/proyecfer";
import type { CollabNotificationItem } from "../../../types/proyecfer";

export function CollabNotificationsBell() {
  const [items, setItems] = useState<CollabNotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchCollabNotifications());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const unread = items.filter((i) => !i.readAt).length;

  const handleRead = async (id: string) => {
    try {
      await markCollabNotificationRead(id);
      await load();
    } catch {
      message.error("No se pudo marcar como leida");
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllCollabNotificationsRead();
      await load();
    } catch {
      message.error("No se pudo marcar todo");
    }
  };

  const content = (
    <div style={{ width: 320 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <Typography.Text strong>Notificaciones</Typography.Text>
        {unread > 0 && (
          <Button type="link" size="small" onClick={() => void handleReadAll()}>
            Marcar todas
          </Button>
        )}
      </div>
      <List
        size="small"
        style={{ maxHeight: 360, overflow: "auto" }}
        dataSource={items}
        locale={{ emptyText: "Sin notificaciones" }}
        renderItem={(n) => (
          <List.Item
            style={{ opacity: n.readAt ? 0.6 : 1, cursor: "pointer", padding: "8px 0" }}
            onClick={() => !n.readAt && void handleRead(n.id)}
          >
            <div>
              <Typography.Text strong>{n.title}</Typography.Text>
              {n.body && <div><Typography.Text type="secondary">{n.body}</Typography.Text></div>}
            </div>
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void load();
      }}
    >
      <Badge count={unread} size="small">
        <Button type="text" icon={<BellOutlined />} aria-label="Notificaciones ProyecFer" />
      </Badge>
    </Popover>
  );
}
