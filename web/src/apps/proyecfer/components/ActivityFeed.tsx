import { Card, List, Typography } from "antd";
import dayjs from "dayjs";
import type { ActivityItem } from "../../../types/proyecfer";

const ACTION_LABELS: Record<string, string> = {
  CREATED: "creo",
  UPDATED: "actualizo",
  DELETED: "elimino",
  STATUS_CHANGED: "cambio estado",
  ASSIGNED: "asigno",
  COMMENTED: "comento",
  MEMBER_ADDED: "agrego miembro",
  MEMBER_REMOVED: "elimino miembro",
  ROLE_CHANGED: "cambio rol",
};

type Props = { items: ActivityItem[] };

export function ActivityFeed({ items }: Props) {
  return (
    <Card title="Historial" size="small" className="panel-card">
      {items.length === 0 ? (
        <Typography.Text type="secondary">Sin actividad reciente</Typography.Text>
      ) : (
        <List
          size="small"
          dataSource={items.slice(0, 15)}
          renderItem={(item) => (
            <List.Item style={{ padding: "8px 0" }}>
              <Typography.Text style={{ fontSize: 13 }}>
                <strong>{item.actor.fullName}</strong> {ACTION_LABELS[item.action] ?? item.action}{" "}
                {item.targetType && <span style={{ color: "#64748b" }}>{item.targetType}</span>}
                <div style={{ fontSize: 11, color: "#64748b" }}>{dayjs(item.createdAt).format("DD MMM HH:mm")}</div>
              </Typography.Text>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
