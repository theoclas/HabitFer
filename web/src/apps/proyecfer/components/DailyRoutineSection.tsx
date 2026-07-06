import { CheckOutlined, FireOutlined, PlusOutlined } from "@ant-design/icons";
import { Card, DatePicker, Empty, Spin, Tag, Typography, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useState } from "react";
import {
  completeDailyCollabTask,
  fetchProjectDailyTasks,
  uncompleteDailyCollabTask,
} from "../../../api/proyecfer";
import type { CollabTask } from "../../../types/proyecfer";

type Props = {
  projectId: string;
  canEdit: boolean;
};

export function DailyRoutineSection({ projectId, canEdit }: Props) {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs());
  const [tasks, setTasks] = useState<CollabTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const dateKey = selectedDate.format("YYYY-MM-DD");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await fetchProjectDailyTasks(projectId, dateKey));
    } catch {
      message.error("No se pudieron cargar las rutinas");
    } finally {
      setLoading(false);
    }
  }, [projectId, dateKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (task: CollabTask) => {
    if (!canEdit) return;
    setTogglingId(task.id);
    try {
      if (task.completedOnDate) {
        await uncompleteDailyCollabTask(task.id, dateKey);
      } else {
        await completeDailyCollabTask(task.id, dateKey);
      }
      await load();
    } catch {
      message.error("No se pudo actualizar");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 120 }}>
        <Spin />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Empty
        description="Sin rutinas diarias"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ margin: "16px 0" }}
      />
    );
  }

  const done = tasks.filter((t) => t.completedOnDate).length;

  return (
    <div className="daily-routine-section">
      <div className="daily-routine-section__toolbar">
        <Typography.Text strong style={{ color: "#a5b4fc" }}>
          Rutinas del dia ({done}/{tasks.length})
        </Typography.Text>
        <DatePicker
          value={selectedDate}
          onChange={(d) => d && setSelectedDate(d)}
          allowClear={false}
          format="DD MMM YYYY"
        />
      </div>

      <div className="daily-routine-list">
        {tasks.map((task) => {
          const done = task.completedOnDate;
          return (
            <Card key={task.id} size="small" className={`daily-routine-card ${done ? "daily-routine-card--done" : ""}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  disabled={!canEdit || togglingId === task.id}
                  onClick={() => void toggle(task)}
                  className={`daily-routine-check ${done ? "daily-routine-check--done" : ""}`}
                  aria-label={done ? "Desmarcar" : "Marcar"}
                >
                  {done ? <CheckOutlined /> : <PlusOutlined />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Text
                    strong
                    style={{
                      color: done ? "#94a3b8" : "#f1f5f9",
                      textDecoration: done ? "line-through" : "none",
                    }}
                  >
                    {task.title}
                  </Typography.Text>
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {task.assignee && <Tag color="geekblue">@{task.assignee.username}</Tag>}
                    {(task.currentStreak ?? 0) > 0 && (
                      <Tag icon={<FireOutlined />} color="volcano">
                        {task.currentStreak} dias
                      </Tag>
                    )}
                    <Tag color="purple">{task.rate7d ?? 0}% 7d</Tag>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
