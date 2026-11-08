import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Spin, Typography, message } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeHabit, fetchHabits, uncompleteHabit } from "../api/client";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { useAchievements } from "../features/achievements/AchievementContext";
import { CollapsibleHabitSection } from "../features/habits/CollapsibleHabitSection";
import { applyOptimisticToggle } from "../features/habits/habitUtils";
import { RemindersBell } from "../features/reminders/RemindersBell";
import { useIsMobile } from "../hooks/useIsMobile";
import type { Habit } from "../types";
import { todayKey } from "../utils/dates";

export function HabitsPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { celebrate } = useAchievements();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const pendingRef = useRef(new Set<string>());

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

  const cardLayout = isMobile ? "list" : "grid";

  const handleToggle = async (habit: Habit) => {
    if (!habit.scheduledToday) {
      message.info("Este habito no esta programado para hoy");
      return;
    }
    if (pendingRef.current.has(habit.id)) return;
    const original = habits.find((h) => h.id === habit.id);
    if (!original) return;
    const willComplete = !original.completedToday;
    const day = todayKey();

    pendingRef.current.add(habit.id);
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? applyOptimisticToggle(h, willComplete) : h)));
    try {
      let fresh: Habit;
      if (willComplete) {
        const result = await completeHabit(habit.id, day);
        if (result.unlockedAchievement) celebrate(result.unlockedAchievement);
        fresh = result.habit;
      } else {
        fresh = await uncompleteHabit(habit.id, day);
      }
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? fresh : h)));
    } catch {
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? original : h)));
      message.error("No se pudo actualizar el habito, lo deje como estaba");
    } finally {
      pendingRef.current.delete(habit.id);
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

  const openDetail = (habit: Habit) => {
    navigate(`/app/habitfer/habits/${habit.id}`);
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
            layout={cardLayout}
            onToggle={handleToggle}
            onOpen={openDetail}
            onEdit={openEdit}
          />
          <CollapsibleHabitSection
            id="todos"
            title={`Todos (${habits.length})`}
            habits={habits}
            layout={cardLayout}
            onToggle={handleToggle}
            onOpen={openDetail}
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
