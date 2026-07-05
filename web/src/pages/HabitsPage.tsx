import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Spin, Typography, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { completeHabit, fetchHabits, uncompleteHabit } from "../api/client";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { CollapsibleHabitSection } from "../features/habits/CollapsibleHabitSection";
import { RemindersBell } from "../features/reminders/RemindersBell";
import { useIsMobile } from "../hooks/useIsMobile";
import type { Habit } from "../types";
import dayjs from "dayjs";

export function HabitsPage() {
  const isMobile = useIsMobile();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

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
  const cardLayout = isMobile ? "list" : "grid";

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
    setEditorOpen(true);
  };

  const openEdit = (habit: Habit) => {
    setEditing(habit);
    setEditorOpen(true);
  };

  const scheduled = habits.filter((h) => h.scheduledToday);

  return (
    <div>
      <div className="page-header">
        {isMobile && <Typography.Title level={3} className="page-header__title">Habitos</Typography.Title>}
        {!isMobile && (
          <div>
            <Typography.Text type="secondary">Gestiona todos tus habitos</Typography.Text>
          </div>
        )}
        <div className="page-header__actions">
          {isMobile && <RemindersBell />}
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: "#2dd4bf", borderColor: "#2dd4bf", color: "#0a0a0f", borderRadius: isMobile ? 12 : 10 }}>
            Nuevo
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", minHeight: 120 }}><Spin /></div>
      ) : habits.length === 0 ? (
        <Empty description="Crea tu primer habito">
          <Button type="primary" onClick={openCreate} style={{ background: "#2dd4bf", borderColor: "#2dd4bf", color: "#0a0a0f" }}>Crear habito</Button>
        </Empty>
      ) : (
        <>
          <CollapsibleHabitSection
            id="hoy"
            title={`Hoy (${scheduled.length})`}
            habits={scheduled}
            togglingId={togglingId}
            layout={cardLayout}
            onToggle={handleToggle}
            onOpen={openEdit}
            onEdit={openEdit}
          />
          <CollapsibleHabitSection
            id="todos"
            title={`Todos (${habits.length})`}
            habits={habits}
            togglingId={togglingId}
            layout={cardLayout}
            onToggle={handleToggle}
            onOpen={openEdit}
            onEdit={openEdit}
          />
        </>
      )}

      <HabitEditorDrawer
        open={editorOpen}
        habit={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
