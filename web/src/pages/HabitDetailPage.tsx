import { ArrowLeftOutlined, EditOutlined, FireOutlined } from "@ant-design/icons";
import { Button, Card, Empty, List, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { formatCalendarDate } from "../utils/dates";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { completeHabit, fetchHabit, uncompleteHabit } from "../api/client";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { HabitCard } from "../features/habits/HabitCard";
import { useAchievements } from "../features/achievements/AchievementContext";
import { habitEmoji } from "../features/habits/habitUtils";
import type { Habit } from "../types";

export function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { celebrate } = useAchievements();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setHabit(await fetchHabit(id));
    } catch {
      message.error("Habito no encontrado");
      navigate("/app/habitfer/habits");
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
        const result = await completeHabit(habit.id);
        setHabit(result.habit);
        if (result.unlockedAchievement) celebrate(result.unlockedAchievement);
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/app/habitfer/habits")}>
          Volver
        </Button>
        <Button type="primary" icon={<EditOutlined />} onClick={() => setEditorOpen(true)} style={{ background: "#2dd4bf", borderColor: "#2dd4bf", color: "#0a0a0f" }}>
          Editar
        </Button>
      </div>
      <Typography.Title level={2}>
        <span style={{ marginRight: 10 }}>{habitEmoji(habit.icon)}</span>
        {habit.title}
      </Typography.Title>
      {habit.description && <Typography.Paragraph type="secondary">{habit.description}</Typography.Paragraph>}

      <Space wrap style={{ marginBottom: 16 }}>
        {habit.streakEnabled && <Tag icon={<FireOutlined />} color="volcano">Racha: {habit.currentStreak}</Tag>}
        {habit.streakEnabled && <Tag>Mejor: {habit.longestStreak}</Tag>}
        <Tag>{habit.scheduleType === "DAILY" ? "Diario" : "Semanal"}</Tag>
      </Space>

      {habit.scheduledToday && (
        <HabitCard habit={habit} loading={toggling} onToggle={handleToggle} onEdit={() => setEditorOpen(true)} />
      )}

      <Card title="Ultimos 90 dias" style={{ marginTop: 16 }}>
        {habit.recentCompletions?.length ? (
          <List
            size="small"
            dataSource={habit.recentCompletions}
            renderItem={(d) => <List.Item>{formatCalendarDate(d)}</List.Item>}
          />
        ) : (
          <Empty description="Sin completados aun" />
        )}
      </Card>

      <HabitEditorDrawer
        open={editorOpen}
        habit={habit}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
