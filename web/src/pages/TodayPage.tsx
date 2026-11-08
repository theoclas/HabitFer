import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Progress, Spin, Typography, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  completeHabit,
  fetchHabitsToday,
  fetchStatsOverview,
  uncompleteHabit,
} from "../api/client";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { HabitCard } from "../features/habits/HabitCard";
import { WeekCalendarStrip } from "../features/habits/WeekCalendarStrip";
import { applyOptimisticToggle } from "../features/habits/habitUtils";
import { useAchievements } from "../features/achievements/AchievementContext";
import { RemindersBell } from "../features/reminders/RemindersBell";
import { useIsMobile } from "../hooks/useIsMobile";
import type { Habit, HabitToday } from "../types";
import { canMarkHabitsForDate } from "../utils/dates";

export function TodayPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { celebrate } = useAchievements();
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs());
  const [habits, setHabits] = useState<HabitToday[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressByDate, setProgressByDate] = useState<Record<string, number>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  /** Habitos con un cambio en vuelo: un segundo toque se ignora hasta que responda el servidor. */
  const pendingRef = useRef(new Set<string>());
  /** Solo la ultima carga pedida puede escribir el estado (evita que una respuesta vieja pise otro dia). */
  const loadSeqRef = useRef(0);

  const dateKey = selectedDate.format("YYYY-MM-DD");
  const isToday = selectedDate.isSame(dayjs(), "day");
  const canMark = canMarkHabitsForDate(dateKey);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const seq = ++loadSeqRef.current;
      if (!opts?.silent) setLoading(true);
      try {
        const [h, overview] = await Promise.all([
          fetchHabitsToday(dateKey),
          fetchStatsOverview().catch(() => null),
        ]);
        if (seq !== loadSeqRef.current) return;
        setHabits(h);
        if (overview?.habits.daily) {
          const map: Record<string, number> = {};
          for (const d of overview.habits.daily) map[d.date] = d.rate;
          setProgressByDate(map);
        }
      } catch {
        if (!opts?.silent && seq === loadSeqRef.current) message.error("No se pudo cargar habitos");
      } finally {
        if (!opts?.silent && seq === loadSeqRef.current) setLoading(false);
      }
    },
    [dateKey],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const doneCount = useMemo(() => habits.filter((h) => h.completedToday).length, [habits]);
  const progressPct = habits.length ? Math.round((doneCount / habits.length) * 100) : 0;

  /** El anillo del dia elegido sigue al check optimista sin esperar al resumen del servidor. */
  const ringProgress = useMemo(
    () => (loading || habits.length === 0 ? progressByDate : { ...progressByDate, [dateKey]: progressPct }),
    [loading, habits.length, progressByDate, dateKey, progressPct],
  );

  const handleToggle = async (habit: HabitToday | Habit) => {
    if (!canMark) {
      message.warning("Solo puedes marcar habitos de hoy o de ayer");
      return;
    }
    if (pendingRef.current.has(habit.id)) return;
    const original = habits.find((h) => h.id === habit.id);
    if (!original) return;
    const willComplete = !original.completedToday;

    pendingRef.current.add(habit.id);
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? applyOptimisticToggle(h, willComplete) : h)));
    try {
      if (willComplete) {
        const result = await completeHabit(habit.id, dateKey);
        if (result.unlockedAchievement) celebrate(result.unlockedAchievement);
      } else {
        await uncompleteHabit(habit.id, dateKey);
      }
      pendingRef.current.delete(habit.id);
      if (pendingRef.current.size === 0) void load({ silent: true });
    } catch {
      pendingRef.current.delete(habit.id);
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? original : h)));
      message.error("No se pudo actualizar, lo deje como estaba");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (habit: HabitToday | Habit) => {
    setEditing(habit);
    setEditorOpen(true);
  };

  const openDetail = (habit: HabitToday | Habit) => {
    navigate(`/app/habitfer/habits/${habit.id}`);
  };

  const habitList = loading ? (
    <div style={{ display: "grid", placeItems: "center", minHeight: 160 }}>
      <Spin />
    </div>
  ) : habits.length === 0 ? (
    <Empty description="Sin habitos para este dia">
      <Button type="primary" onClick={openCreate} style={{ background: "#2dd4bf", borderColor: "#2dd4bf", color: "#0a0a0f" }}>
        Crear habito
      </Button>
    </Empty>
  ) : (
    <div className={isMobile ? undefined : "habit-grid"}>
      {habits.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          layout={isMobile ? "list" : "grid"}
          canToggle={canMark}
          onToggle={handleToggle}
          onOpen={openDetail}
          onEdit={openEdit}
        />
      ))}
    </div>
  );

  return (
    <div>
      {isMobile ? (
        <div className="page-header--mobile">
          <div className="page-header__left" />
          <Typography.Title level={3} className="page-header__title">
            {isToday ? "Hoy" : selectedDate.format("D MMM")}
          </Typography.Title>
          <div className="page-header__actions">
            <Button type="text" shape="circle" aria-label="Nuevo habito" icon={<PlusOutlined style={{ fontSize: 18, color: "#e2e8f0" }} />} onClick={openCreate} style={{ background: "rgba(255,255,255,0.06)" }} />
            <RemindersBell />
          </div>
        </div>
      ) : (
        <div className="page-header">
          <div>
            <Typography.Title level={2} className="page-header__title">
              {isToday ? "Hoy" : selectedDate.format("dddd, D MMMM")}
            </Typography.Title>
            <Typography.Text type="secondary">
              {doneCount}/{habits.length} habitos completados
            </Typography.Text>
          </div>
          <div className="page-header__actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: "#2dd4bf", borderColor: "#2dd4bf", color: "#0a0a0f", borderRadius: 10 }}>
              Nuevo habito
            </Button>
          </div>
        </div>
      )}

      <div className="today-layout">
        {!isMobile && (
          <aside className="today-layout__sidebar">
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 10, fontSize: 13 }}>
              Semana
            </Typography.Text>
            <WeekCalendarStrip
              selected={selectedDate}
              onSelect={setSelectedDate}
              progressByDate={ringProgress}
              vertical
            />
            <div className="today-progress-card">
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>Progreso del dia</Typography.Text>
              <div style={{ marginTop: 12 }}>
                <Progress percent={progressPct} strokeColor="#2dd4bf" trailColor="#2a2a3a" />
              </div>
              <Typography.Text style={{ display: "block", marginTop: 8, fontSize: 24, fontWeight: 700 }}>
                {doneCount}/{habits.length}
              </Typography.Text>
            </div>
          </aside>
        )}

        <section>
          {isMobile && (
            <>
              <WeekCalendarStrip selected={selectedDate} onSelect={setSelectedDate} progressByDate={ringProgress} />
              <Typography.Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: 13 }}>
                {doneCount}/{habits.length} completados
              </Typography.Text>
            </>
          )}
          {!isMobile && (
            <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 16, fontWeight: 700 }}>
              Habitos del dia
            </Typography.Title>
          )}
          {!canMark && (
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12, fontSize: 13 }}>
              Vista de solo lectura — solo puedes marcar habitos de hoy o de ayer
            </Typography.Text>
          )}
          {habitList}
        </section>
      </div>

      <HabitEditorDrawer
        open={editorOpen}
        habit={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
