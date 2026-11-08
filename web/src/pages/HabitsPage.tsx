import { PlusOutlined } from "@ant-design/icons";
import { Button, message } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHabits } from "../api/client";
import { toggleHabitRemote } from "../apps/habitfer/offline";
import { HABITS_CHANGED_EVENT } from "../apps/habitfer/effects";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { useAchievements } from "../features/achievements/AchievementContext";
import { CollapsibleHabitSection } from "../features/habits/CollapsibleHabitSection";
import { applyOptimisticToggle } from "../features/habits/habitUtils";
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

  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(HABITS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(HABITS_CHANGED_EVENT, onChanged);
  }, [load]);

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
      const res = await toggleHabitRemote(habit.id, day, willComplete);
      if (res.queued) {
        message.open({ key: "hf-offline", type: "info", content: "Sin conexión: lo guardé y lo envío cuando vuelva la señal" });
        return;
      }
      let fresh: Habit;
      if ("completed" in res) {
        if (res.completed.unlockedAchievement) celebrate(res.completed.unlockedAchievement);
        fresh = res.completed.habit;
      } else {
        fresh = res.uncompleted;
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
    navigate(`/app/habitfer/habits/${habit.id}`, { viewTransition: true, state: { habit } });
  };

  const scheduled = habits.filter((h) => h.scheduledToday);

  return (
    <div>
      <div className="hf-page-head">
        <div>
          <div className="hf-kicker">{habits.length} activos · {scheduled.length} hoy</div>
          <h1 className="hf-title hf-title--sm">Todos tus hábitos</h1>
        </div>
        {!isMobile && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Nuevo
          </Button>
        )}
      </div>

      {loading ? (
        <div className="hf-list" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="hf-skel hf-skel--card" />
          ))}
        </div>
      ) : habits.length === 0 ? (
        <div className="hf-empty">
          <b>Todavía no tienes hábitos</b>
          <p style={{ margin: "0 0 16px" }}>Crea el primero con el botón +.</p>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Crear hábito
          </Button>
        </div>
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
