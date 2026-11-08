import { ArrowLeftOutlined, CheckOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Skeleton, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { completeHabit, fetchHabit, uncompleteHabit } from "../api/client";
import { Flame, flameStage } from "../apps/habitfer/components/Flame";
import { burstSparks, buzz } from "../apps/habitfer/effects";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { useAchievements } from "../features/achievements/AchievementContext";
import { HABIT_HERO_TRANSITION } from "../features/habits/HabitCard";
import { applyOptimisticToggle, habitEmoji, habitScheduleLabel } from "../features/habits/habitUtils";
import type { Habit } from "../types";
import { todayKey } from "../utils/dates";

const TIME_LABEL: Record<Habit["timeOfDay"], string> = {
  ANYTIME: "",
  MORNING: "Mañana",
  AFTERNOON: "Tarde",
  EVENING: "Noche",
};

/** Ultimas 13 semanas en cuadritos (el heatmap anual completo llega en la fase 2). */
function RecentGrid({ habit }: { habit: Habit }) {
  const done = useMemo(() => new Set(habit.recentCompletions ?? []), [habit.recentCompletions]);
  const end = dayjs().startOf("day");
  const start = end.subtract(12, "week").startOf("week");
  const weeks = Math.ceil((end.diff(start, "day") + 1) / 7);
  const cell = 12;
  const gap = 3;
  const rects = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = start.add(w * 7 + d, "day");
      if (day.isAfter(end)) continue;
      const hit = done.has(day.format("YYYY-MM-DD"));
      rects.push(
        <rect
          key={w * 7 + d}
          x={w * (cell + gap)}
          y={d * (cell + gap)}
          width={cell}
          height={cell}
          rx={3}
          fill={hit ? habit.color : "var(--hf-track)"}
        >
          <title>{`${day.format("D MMM")}${hit ? " · hecho" : ""}`}</title>
        </rect>,
      );
    }
  }
  const width = weeks * (cell + gap) - gap;
  const height = 7 * (cell + gap) - gap;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", maxWidth: 520, height: "auto", display: "block" }} role="img" aria-label={`${done.size} veces en los ultimos 90 dias`}>
      {rects}
    </svg>
  );
}

export function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { celebrate } = useAchievements();
  const fromList = (location.state as { habit?: Habit } | null)?.habit;
  const [habit, setHabit] = useState<Habit | null>(fromList && fromList.id === id ? fromList : null);
  const [loading, setLoading] = useState(true);
  const pendingRef = useRef(false);
  const [editorOpen, setEditorOpen] = useState(false);

  /** Vuelve a la pantalla de donde vino (Hoy o Habitos); si se abrio directo, a Habitos. */
  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/app/habitfer/habits", { viewTransition: true });
  };

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

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (e: MouseEvent<HTMLElement>) => {
    if (!habit || pendingRef.current) return;
    const original = habit;
    const willComplete = !original.completedToday;
    const day = todayKey();
    if (willComplete) {
      burstSparks(e.currentTarget, original.color);
      buzz();
    }

    pendingRef.current = true;
    setHabit(applyOptimisticToggle(original, willComplete));
    try {
      if (willComplete) {
        const result = await completeHabit(original.id, day);
        setHabit(result.habit);
        if (result.unlockedAchievement) celebrate(result.unlockedAchievement);
      } else {
        setHabit(await uncompleteHabit(original.id, day));
      }
    } catch {
      setHabit(original);
      message.error("No se pudo actualizar, lo deje como estaba");
    } finally {
      pendingRef.current = false;
    }
  };

  if (!habit) {
    return loading ? <Skeleton active paragraph={{ rows: 6 }} /> : null;
  }

  const stage = flameStage(habit.currentStreak);
  const momento = TIME_LABEL[habit.timeOfDay ?? "ANYTIME"];
  const last90 = habit.recentCompletions?.length;

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={goBack}>
          Volver
        </Button>
        <Button icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
          Editar
        </Button>
      </div>

      <section
        className="hf-detail-hero"
        style={{ "--c": habit.color, viewTransitionName: HABIT_HERO_TRANSITION } as CSSProperties}
      >
        <div className="hf-detail-hero__top">
          <span className="hf-card__emoji" style={{ width: 56, height: 56, fontSize: 30 }} aria-hidden="true">
            {habitEmoji(habit.icon)}
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 className="hf-detail-hero__title">{habit.title}</h1>
            <div className="hf-detail-hero__sub">
              {habitScheduleLabel(habit)}
              {momento ? ` · ${momento}` : ""}
              {habit.reminderEnabled && habit.reminderTime ? ` · aviso ${habit.reminderTime}` : ""}
            </div>
          </div>
        </div>

        {habit.streakEnabled && (
          <div className="hf-detail-hero__streak">
            {stage && <Flame stage={stage} size={54} glow />}
            <span className="hf-detail-hero__big">{habit.currentStreak}</span>
            <span className="hf-detail-hero__lab">
              <b>{habit.currentStreak === 1 ? "día de racha" : "días de racha"}</b>
              {stage ? stage.name : "Marca hoy para encenderla"}
            </span>
          </div>
        )}

        <div className="hf-detail-hero__stats">
          <div>
            <b>{habit.longestStreak}</b>
            <span>mejor racha</span>
          </div>
          <div>
            <b>{last90 ?? "—"}</b>
            <span>veces en 90 días</span>
          </div>
        </div>

        {habit.scheduledToday && (
          <Button
            type={habit.completedToday ? "default" : "primary"}
            size="large"
            block
            icon={<CheckOutlined />}
            style={{ marginTop: 16 }}
            onClick={(e) => void handleToggle(e)}
          >
            {habit.completedToday ? "Hecho hoy · tocar para desmarcar" : "Marcar hoy"}
          </Button>
        )}
      </section>

      {habit.description && <p style={{ color: "var(--hf-muted)", margin: "0 4px 18px" }}>{habit.description}</p>}

      <section className="hf-habit-track">
        <div className="hf-section__head" style={{ margin: "0 0 12px" }}>
          <span>Últimas 13 semanas</span>
          <button type="button" className="hf-link" onClick={() => navigate("/app/habitfer/logros", { viewTransition: true })}>
            Ver logros
          </button>
        </div>
        <RecentGrid habit={habit} />
      </section>

      <HabitEditorDrawer open={editorOpen} habit={habit} onClose={() => setEditorOpen(false)} onSaved={() => void load()} />
    </div>
  );
}
