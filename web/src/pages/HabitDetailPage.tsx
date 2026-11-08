import { ArrowLeftOutlined, CheckOutlined, EditOutlined, FormOutlined } from "@ant-design/icons";
import { Button, Skeleton, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchHabit, fetchHabitAchievements, fetchStatsRange } from "../api/client";
import { toggleHabitRemote } from "../apps/habitfer/offline";
import { Flame, flameStage } from "../apps/habitfer/components/Flame";
import { MonthCalendar } from "../apps/habitfer/components/MonthCalendar";
import { NoteSheet } from "../apps/habitfer/components/NoteSheet";
import { WeekdayBars } from "../apps/habitfer/components/StatsWidgets";
import { YearHeatmap } from "../apps/habitfer/components/YearHeatmap";
import { burstSparks, buzz, playTick } from "../apps/habitfer/effects";
import { fmtInt } from "../apps/habitfer/format";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { useAchievements } from "../features/achievements/AchievementContext";
import { getNextMilestone } from "../features/achievements/milestones";
import { HABIT_HERO_TRANSITION } from "../features/habits/HabitCard";
import { applyOptimisticToggle, habitEmoji, habitScheduleLabel } from "../features/habits/habitUtils";
import type { Habit, HabitAchievementRow, StatsRange } from "../types";
import { todayKey } from "../utils/dates";

const TIME_LABEL: Record<Habit["timeOfDay"], string> = {
  ANYTIME: "",
  MORNING: "Mañana",
  AFTERNOON: "Tarde",
  EVENING: "Noche",
};

function milestoneLabel(d: number) {
  if (d === 3) return "Primer paso";
  if (d === 5) return "Constancia inicial";
  if (d === 10) return "Una semana y más";
  if (d <= 50) return `${d} días seguidos`;
  return `${d} días de disciplina`;
}

export function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { celebrate } = useAchievements();
  const fromList = (location.state as { habit?: Habit } | null)?.habit;
  const [habit, setHabit] = useState<Habit | null>(fromList && fromList.id === id ? fromList : null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(() => dayjs().year());
  const [month, setMonth] = useState<Dayjs>(() => dayjs().startOf("month"));
  const [yearData, setYearData] = useState<StatsRange | null>(null);
  const [last30, setLast30] = useState<StatsRange | null>(null);
  const [achievements, setAchievements] = useState<HabitAchievementRow[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const pendingRef = useRef(false);

  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/app/habitfer/habits", { viewTransition: true });
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [h, l30, ach] = await Promise.all([
        fetchHabit(id),
        fetchStatsRange({ habitId: id }).catch(() => null),
        fetchHabitAchievements(id).catch(() => [] as HabitAchievementRow[]),
      ]);
      setHabit(h);
      setLast30(l30);
      setAchievements(ach);
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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setYearData(null);
    fetchStatsRange({ from: `${year}-01-01`, to: `${year}-12-31`, habitId: id })
      .then((d) => !cancelled && setYearData(d))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, year]);

  const byDate = useMemo(() => new Map((yearData?.days ?? []).map((d) => [d.date, d])), [yearData]);
  const notes = useMemo(() => new Map((habit?.recentNotes ?? []).map((n) => [n.date, n.note])), [habit?.recentNotes]);
  const noteDates = useMemo(() => new Set(notes.keys()), [notes]);

  const changeYear = (y: number) => {
    setYear(y);
    setMonth(y === dayjs().year() ? dayjs().startOf("month") : dayjs(`${y}-12-01`));
  };
  const changeMonth = (delta: number) => {
    const next = month.add(delta, "month");
    setMonth(next);
    if (next.year() !== year) setYear(next.year());
  };

  const handleToggle = async (e: MouseEvent<HTMLElement>) => {
    if (!habit || pendingRef.current) return;
    const original = habit;
    const willComplete = !original.completedToday;
    const day = todayKey();
    if (willComplete) {
      burstSparks(e.currentTarget, original.color);
      buzz();
      playTick();
    }
    pendingRef.current = true;
    setHabit(applyOptimisticToggle(original, willComplete));
    try {
      const res = await toggleHabitRemote(original.id, day, willComplete);
      if (res.queued) {
        message.open({ key: "hf-offline", type: "info", content: "Sin conexión: lo guardé y lo envío cuando vuelva la señal" });
        return;
      }
      if ("completed" in res) {
        setHabit(res.completed.habit);
        if (res.completed.unlockedAchievement) {
          celebrate(res.completed.unlockedAchievement);
          setAchievements(await fetchHabitAchievements(original.id).catch(() => achievements));
        }
      } else {
        setHabit(res.uncompleted);
      }
      fetchStatsRange({ from: `${year}-01-01`, to: `${year}-12-31`, habitId: original.id }).then(setYearData).catch(() => undefined);
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
  const next = habit.streakEnabled ? getNextMilestone(habit.currentStreak) : null;
  const minYear = dayjs(habit.createdAt).year();
  const notesList = habit.recentNotes ?? [];
  const todayNote = notes.get(todayKey()) ?? null;

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={goBack}>
          Volver
        </Button>
        <Button icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
          Editar
        </Button>
      </div>

      <section className="hf-detail-hero" style={{ "--c": habit.color, viewTransitionName: HABIT_HERO_TRANSITION } as CSSProperties}>
        <div className="hf-detail-hero__top">
          <span className="hf-card__emoji" style={{ width: 56, height: 56, fontSize: 30 }} aria-hidden="true">
            {habitEmoji(habit.icon)}
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 className="hf-detail-hero__title">{habit.title}</h1>
            <div className="hf-detail-hero__sub">
              {habitScheduleLabel(habit)}
              {momento ? ` · ${momento}` : ""}
              {habit.reminderEnabled && (habit.reminderTimes?.length || habit.reminderTime)
                ? ` · aviso ${(habit.reminderTimes?.length ? habit.reminderTimes : [habit.reminderTime]).join(", ")}`
                : ""}
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
              {next ? ` · próximo logro a los ${next}` : ""}
            </span>
          </div>
        )}

        <div className="hf-detail-hero__stats hf-detail-hero__stats--3">
          <div>
            <b>{habit.longestStreak}</b>
            <span>mejor racha</span>
          </div>
          <div>
            <b>{habit.totalCompletions !== undefined ? fmtInt(habit.totalCompletions) : "—"}</b>
            <span>veces en total</span>
          </div>
          <div>
            <b>{last30 ? `${last30.totals.rate} %` : "—"}</b>
            <span>últimos 30 días</span>
          </div>
        </div>

        {habit.scheduledToday && (
          <div className="hf-detail-hero__actions">
            <Button
              type={habit.completedToday ? "default" : "primary"}
              size="large"
              icon={<CheckOutlined />}
              onClick={(e) => void handleToggle(e)}
              style={{ flex: 1 }}
            >
              {habit.completedToday ? "Hecho hoy · desmarcar" : "Marcar hoy"}
            </Button>
            <Button size="large" icon={<FormOutlined />} onClick={() => setNoteOpen(true)} aria-label="Nota de hoy">
              {todayNote ? "Editar nota" : "Nota"}
            </Button>
          </div>
        )}
      </section>

      {habit.description && <p style={{ color: "var(--hf-muted)", margin: "0 4px 18px" }}>{habit.description}</p>}

      {notesList.length > 0 && (
        <section className="hf-panel">
          <div className="hf-panel__head">
            <h2>Notas</h2>
            <span>{notesList.length === 1 ? "1 nota" : `${notesList.length} notas recientes`}</span>
          </div>
          <div className="hf-notes">
            {(showAllNotes ? notesList : notesList.slice(0, 3)).map((n) => (
              <figure key={n.date} className="hf-notes__item" style={{ "--c": habit.color } as CSSProperties}>
                <blockquote>{n.note}</blockquote>
                <figcaption>{dayjs(n.date).format("dddd D [de] MMMM")}</figcaption>
              </figure>
            ))}
          </div>
          {notesList.length > 3 && (
            <button type="button" className="hf-link" onClick={() => setShowAllNotes((v) => !v)} style={{ marginTop: 10 }}>
              {showAllNotes ? "Ver menos" : `Ver las ${notesList.length}`}
            </button>
          )}
        </section>
      )}

      <section className="hf-panel">
        <div className="hf-panel__head">
          <h2>Tu año con este hábito</h2>
          {noteDates.size > 0 && <span>punto = nota</span>}
        </div>
        <YearHeatmap
          year={year}
          days={yearData?.days ?? null}
          mode="habit"
          color={habit.color}
          minYear={minYear}
          onYearChange={changeYear}
          noteDates={noteDates}
        />
      </section>

      <div className="hf-grid2">
        <section className="hf-panel">
          <div className="hf-panel__head">
            <h2>Mes a mes</h2>
          </div>
          <MonthCalendar
            month={month}
            byDate={byDate}
            color={habit.color}
            notes={notes}
            canPrev={month.isAfter(dayjs(habit.createdAt).startOf("month"), "month")}
            onPrev={() => changeMonth(-1)}
            onNext={() => changeMonth(1)}
          />
        </section>
        <section className="hf-panel">
          <div className="hf-panel__head">
            <h2>Por día de la semana</h2>
            <span>{year}</span>
          </div>
          {yearData ? <WeekdayBars rows={yearData.byWeekday} color={habit.color} /> : <div className="hf-skel" style={{ height: 150 }} />}
        </section>
      </div>

      <section className="hf-panel">
        <div className="hf-panel__head">
          <h2>Logros</h2>
          <button type="button" className="hf-link" onClick={() => navigate("/app/habitfer/logros", { viewTransition: true })}>
            Ver vitrina
          </button>
        </div>
        {achievements.length === 0 && !next ? (
          <p className="hf-note">Activa la racha de este hábito para ganar medallas.</p>
        ) : (
          <div className="hf-habit-track__row">
            {achievements.map((a) => (
              <button
                key={a.id}
                type="button"
                className="hf-medal-btn"
                aria-label={`${a.milestoneDays} días, ver frase`}
                onClick={() =>
                  celebrate(
                    {
                      ...a,
                      habitTitle: habit.title,
                      habitColor: habit.color,
                      habitIcon: habit.icon,
                      label: milestoneLabel(a.milestoneDays),
                    },
                    { replay: true },
                  )
                }
              >
                <span className="hf-medal" style={{ "--m": flameStage(a.milestoneDays)?.outer } as CSSProperties}>
                  {habitEmoji(habit.icon)}
                  <b>{a.milestoneDays}</b>
                </span>
              </button>
            ))}
            {next && (
              <span className="hf-medal-cell" title={`Faltan ${next - habit.currentStreak} días`}>
                <span className="hf-medal hf-medal--locked">
                  {habitEmoji(habit.icon)}
                  <b>{next}</b>
                </span>
              </span>
            )}
          </div>
        )}
      </section>

      <HabitEditorDrawer open={editorOpen} habit={habit} onClose={() => setEditorOpen(false)} onSaved={() => void load()} />
      <NoteSheet
        open={noteOpen}
        habit={habit}
        date={todayKey()}
        initialNote={todayNote}
        completed={habit.completedToday}
        onClose={() => setNoteOpen(false)}
        onSaved={(result) => {
          setHabit(result.habit);
          if (result.unlockedAchievement) celebrate(result.unlockedAchievement);
        }}
      />
    </div>
  );
}
