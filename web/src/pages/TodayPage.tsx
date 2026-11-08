import { PlusOutlined, TrophyOutlined } from "@ant-design/icons";
import { Button, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHabitsToday, fetchMoods, fetchStatsOverview, fetchTasksToday } from "../api/client";
import { Flame, PERFECT_STAGE } from "../apps/habitfer/components/Flame";
import { MoodPicker } from "../apps/habitfer/components/MoodPicker";
import { NoteSheet } from "../apps/habitfer/components/NoteSheet";
import { ProgressOrb } from "../apps/habitfer/components/ProgressOrb";
import { LevelBar } from "../apps/habitfer/components/StatsWidgets";
import { TodayTasks } from "../apps/habitfer/components/TodayTasks";
import { InstallCard } from "../apps/habitfer/components/InstallCard";
import { HABITS_CHANGED_EVENT } from "../apps/habitfer/effects";
import { toggleHabitRemote } from "../apps/habitfer/offline";
import { setAppBadge } from "../apps/habitfer/pwa";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { useAchievements } from "../features/achievements/AchievementContext";
import { HabitCard } from "../features/habits/HabitCard";
import { applyOptimisticToggle } from "../features/habits/habitUtils";
import { WeekCalendarStrip } from "../features/habits/WeekCalendarStrip";
import { useIsMobile } from "../hooks/useIsMobile";
import type { CompleteHabitResponse, Habit, HabitToday, LevelInfo, Task, TimeOfDay } from "../types";
import { canMarkHabitsForDate } from "../utils/dates";

const MOMENTS: Record<TimeOfDay, { label: string; hint: string }> = {
  MORNING: { label: "Mañana", hint: "hasta las 12" },
  AFTERNOON: { label: "Tarde", hint: "de 12 a 6" },
  EVENING: { label: "Noche", hint: "desde las 6" },
  ANYTIME: { label: "En cualquier momento", hint: "" },
};
const NATURAL_ORDER: TimeOfDay[] = ["MORNING", "AFTERNOON", "EVENING", "ANYTIME"];

function momentNow(now: Dayjs): TimeOfDay {
  const h = now.hour();
  return h < 12 ? "MORNING" : h < 18 ? "AFTERNOON" : "EVENING";
}

/** Hoy: el momento actual primero, luego lo de "cualquier momento" y despues el resto del dia. */
function sectionOrder(isToday: boolean, now: Dayjs): TimeOfDay[] {
  if (!isToday) return NATURAL_ORDER;
  const current = momentNow(now);
  return [current, "ANYTIME", ...NATURAL_ORDER.filter((m) => m !== current && m !== "ANYTIME")];
}

type OverviewBits = {
  progressByDate: Record<string, number>;
  perfectStreak: number;
  todayPerfect: boolean;
  level: LevelInfo | null;
};

export function TodayPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { celebrate, celebratePerfectDay } = useAchievements();
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs());
  const [habits, setHabits] = useState<HabitToday[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mood, setMoodValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewBits | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [noteTarget, setNoteTarget] = useState<HabitToday | null>(null);
  const [slideBack, setSlideBack] = useState(false);
  const pendingRef = useRef(new Set<string>());
  const loadSeqRef = useRef(0);
  const habitsRef = useRef<HabitToday[]>([]);
  const overviewRef = useRef<OverviewBits | null>(null);
  const lastLevelRef = useRef<number | null>(null);
  habitsRef.current = habits;
  overviewRef.current = overview;

  const now = dayjs();
  const dateKey = selectedDate.format("YYYY-MM-DD");
  const todayKey = now.format("YYYY-MM-DD");
  const isToday = dateKey === todayKey;
  const isYesterday = dateKey === now.subtract(1, "day").format("YYYY-MM-DD");
  const canMark = canMarkHabitsForDate(dateKey);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const seq = ++loadSeqRef.current;
      if (!opts?.silent) setLoading(true);
      try {
        const isTodayKey = dateKey === dayjs().format("YYYY-MM-DD");
        const [h, ov, t, moods] = await Promise.all([
          fetchHabitsToday(dateKey),
          fetchStatsOverview().catch(() => null),
          isTodayKey && !opts?.silent ? fetchTasksToday().catch(() => null) : Promise.resolve(undefined),
          opts?.silent ? Promise.resolve(undefined) : fetchMoods(dateKey, dateKey).catch(() => []),
        ]);
        if (seq !== loadSeqRef.current) return;
        setHabits(h);
        if (ov) {
          const map: Record<string, number> = {};
          for (const d of ov.habits.daily) map[d.date] = d.rate;
          const level = ov.habits.level ?? null;
          // Subio de nivel desde la ultima vez que se vio esta pantalla.
          if (level && lastLevelRef.current !== null && level.level > lastLevelRef.current) {
            message.open({
              type: "success",
              icon: <TrophyOutlined style={{ color: "var(--hf-ember)" }} />,
              content: `Subiste al nivel ${level.level} · ${level.title}`,
              duration: 4,
            });
          }
          if (level) lastLevelRef.current = level.level;
          setOverview({
            progressByDate: map,
            perfectStreak: ov.habits.perfectStreak ?? 0,
            todayPerfect: !!ov.habits.todayPerfect,
            level,
          });
        }
        if (t !== undefined) setTasks(t ?? []);
        if (moods !== undefined) setMoodValue(moods.find((m) => m.date === dateKey)?.mood ?? null);
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

  useEffect(() => {
    const onChanged = () => void load({ silent: true });
    window.addEventListener(HABITS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(HABITS_CHANGED_EVENT, onChanged);
  }, [load]);

  const selectDate = (d: Dayjs) => {
    setSlideBack(d.isBefore(selectedDate, "day"));
    setSelectedDate(d);
  };

  const hour = now.hour();
  const order = useMemo(() => sectionOrder(isToday, dayjs().hour(hour)), [isToday, hour]);
  const sections = useMemo(
    () =>
      order
        .map((m) => ({ moment: m, items: habits.filter((h) => (h.timeOfDay ?? "ANYTIME") === m) }))
        .filter((s) => s.items.length > 0),
    [order, habits],
  );
  const ordered = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const showHeads = sections.length > 1 || (sections.length === 1 && sections[0].moment !== "ANYTIME");

  const doneCount = habits.filter((h) => h.completedToday).length;
  const total = habits.length;
  const allDone = total > 0 && doneCount === total;
  const progressPct = total ? Math.round((doneCount / total) * 100) : 0;
  const hasNotes = habits.some((h) => h.note);

  useEffect(() => {
    if (isToday && !loading) setAppBadge(total - doneCount);
  }, [isToday, loading, total, doneCount]);

  const ringProgress = useMemo(
    () => (loading || total === 0 ? overview?.progressByDate ?? {} : { ...(overview?.progressByDate ?? {}), [dateKey]: progressPct }),
    [loading, total, overview, dateKey, progressPct],
  );

  const perfectStreak = (() => {
    if (!overview) return 0;
    if (!isToday) return overview.perfectStreak;
    if (allDone && !overview.todayPerfect) return overview.perfectStreak + 1;
    if (!allDone && overview.todayPerfect) return Math.max(0, overview.perfectStreak - 1);
    return overview.perfectStreak;
  })();

  const maybeCelebratePerfectDay = () => {
    const list = habitsRef.current;
    if (!isToday || list.length === 0 || !list.every((h) => h.completedToday)) return;
    const ov = overviewRef.current;
    const streak = ov ? (ov.todayPerfect ? ov.perfectStreak : ov.perfectStreak + 1) : 1;
    celebratePerfectDay({ done: list.length, total: list.length, streak, colors: list.map((h) => h.color) });
  };

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
    const optimistic = habits.map((h) =>
      h.id === habit.id ? { ...applyOptimisticToggle(h, willComplete), note: willComplete ? h.note : null } : h,
    );
    habitsRef.current = optimistic;
    setHabits(optimistic);
    try {
      const res = await toggleHabitRemote(habit.id, dateKey, willComplete);
      pendingRef.current.delete(habit.id);
      if (res.queued) {
        // Sin señal: el check se queda y el cambio se envia solo cuando vuelva la conexion.
        message.open({ key: "hf-offline", type: "info", content: "Sin conexión: lo guardé y lo envío cuando vuelva la señal" });
        if (willComplete) maybeCelebratePerfectDay();
        return;
      }
      if ("completed" in res && res.completed.unlockedAchievement) celebrate(res.completed.unlockedAchievement);
      if (willComplete) maybeCelebratePerfectDay();
      if (pendingRef.current.size === 0) void load({ silent: true });
    } catch {
      pendingRef.current.delete(habit.id);
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? original : h)));
      message.error("No se pudo actualizar, lo deje como estaba");
    }
  };

  /** Guardar una nota tambien marca el habito: se refleja aqui y puede cerrar el dia perfecto. */
  const onNoteSaved = (habitId: string, result: CompleteHabitResponse, note: string | null) => {
    const wasDone = habitsRef.current.find((h) => h.id === habitId)?.completedToday;
    const next = habitsRef.current.map((h) =>
      h.id === habitId ? { ...applyOptimisticToggle(h, true), note } : h,
    );
    habitsRef.current = next;
    setHabits(next);
    if (result.unlockedAchievement) celebrate(result.unlockedAchievement);
    if (!wasDone) maybeCelebratePerfectDay();
    void load({ silent: true });
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
    navigate(`/app/habitfer/habits/${habit.id}`, { viewTransition: true, state: { habit } });
  };
  const openNote = (habit: HabitToday | Habit) => {
    const h = habits.find((x) => x.id === habit.id);
    if (h) setNoteTarget(h);
  };
  const openAchievements = () => navigate("/app/habitfer/logros", { viewTransition: true });

  const weekday = selectedDate.format("dddd");
  const kicker = isToday
    ? `Hoy · ${weekday}`
    : isYesterday
      ? `Ayer · ${weekday}`
      : weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const riskWindow = isToday && now.hour() >= 20;

  const header = (
    <div className="hf-page-head">
      <div>
        <div className="hf-kicker">{kicker}</div>
        <h1 className="hf-title">{selectedDate.format("D [de] MMMM")}</h1>
      </div>
      {!isToday && (
        <button type="button" className="hf-today-chip" onClick={() => selectDate(dayjs())}>
          Ir a hoy
        </button>
      )}
    </div>
  );

  const orbCard =
    loading && habits.length === 0 ? (
      <div className="hf-skel hf-skel--orb" aria-hidden="true" />
    ) : (
      <div className="hf-orb-card">
        <ProgressOrb
          size={isMobile ? 104 : 116}
          done={doneCount}
          total={total}
          segments={ordered.map((h) => ({ id: h.id, color: h.color, progress: h.completedToday ? 1 : 0 }))}
        />
        <div className="hf-orb-side">
          <div className="hf-orb-stat">
            <span className="hf-orb-stat__k">Días perfectos seguidos</span>
            <span className="hf-orb-stat__v">
              {perfectStreak > 0 && <Flame stage={PERFECT_STAGE} size={18} glow />}
              {perfectStreak}
              <small>{perfectStreak === 1 ? "día" : "días"}</small>
            </span>
          </div>
          {overview?.level && <LevelBar level={overview.level} compact />}
          <button type="button" className="hf-link" onClick={openAchievements}>
            Ver logros
          </button>
        </div>
      </div>
    );

  const list = loading && habits.length === 0 ? (
    <div className="hf-list" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="hf-skel hf-skel--card" />
      ))}
    </div>
  ) : habits.length === 0 ? (
    <div className="hf-empty">
      <b>Nada programado para este día</b>
      <p style={{ margin: "0 0 16px" }}>Crea un hábito y empieza a encender tu primera racha.</p>
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
        Crear hábito
      </Button>
    </div>
  ) : (
    <div key={dateKey} className={`hf-day-in${slideBack ? " hf-day-in--back" : ""}`}>
      {!canMark && (
        <p style={{ color: "var(--hf-muted)", fontSize: 13, margin: "0 4px 12px" }}>
          Solo lectura: puedes marcar hábitos de hoy o de ayer.
        </p>
      )}
      {sections.map((s) => (
        <section key={s.moment} className="hf-section">
          {showHeads && (
            <div className="hf-section__head">
              <span>{MOMENTS[s.moment].label}</span>
              {isToday && s.moment === momentNow(now) ? <em>ahora</em> : <span style={{ textTransform: "none", letterSpacing: 0 }}>{MOMENTS[s.moment].hint}</span>}
            </div>
          )}
          <div className={`hf-list${isMobile ? "" : " hf-list--grid"}`}>
            {s.items.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                canToggle={canMark}
                riskWindow={riskWindow}
                onToggle={handleToggle}
                onOpen={openDetail}
                onEdit={openEdit}
                onNote={canMark ? openNote : undefined}
              />
            ))}
          </div>
        </section>
      ))}
      {canMark && !hasNotes && (
        <p className="hf-hint">{isMobile ? "Mantén presionado un hábito" : "Haz clic derecho en un hábito"} para dejar una nota del día.</p>
      )}
      {isToday && <TodayTasks tasks={tasks} onChange={setTasks} />}
      <MoodPicker date={dateKey} value={mood} editable={canMark} onChange={setMoodValue} />
      {isToday && <InstallCard />}
    </div>
  );

  return (
    <div>
      {isMobile ? (
        <>
          {header}
          <WeekCalendarStrip selected={selectedDate} onSelect={selectDate} progressByDate={ringProgress} />
          {orbCard}
          {list}
        </>
      ) : (
        <div className="today-layout">
          <aside className="today-layout__sidebar">
            {orbCard}
            <WeekCalendarStrip selected={selectedDate} onSelect={selectDate} progressByDate={ringProgress} vertical />
          </aside>
          <section style={{ minWidth: 0 }}>
            {header}
            {list}
          </section>
        </div>
      )}

      <HabitEditorDrawer open={editorOpen} habit={editing} onClose={() => setEditorOpen(false)} onSaved={() => void load()} />
      <NoteSheet
        open={noteTarget !== null}
        habit={noteTarget}
        date={dateKey}
        initialNote={noteTarget?.note ?? null}
        completed={!!noteTarget?.completedToday}
        onClose={() => setNoteTarget(null)}
        onSaved={(result, note) => noteTarget && onNoteSaved(noteTarget.id, result, note)}
      />
    </div>
  );
}
