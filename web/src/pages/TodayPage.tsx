import { PlusOutlined, TrophyOutlined } from "@ant-design/icons";
import { Button, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { endPause, fetchHabitsToday, fetchMoods, fetchStatsOverview, fetchTasksToday } from "../api/client";
import { DaySheet } from "../apps/habitfer/components/DaySheet";
import { Flame, PERFECT_STAGE } from "../apps/habitfer/components/Flame";
import { InstallCard } from "../apps/habitfer/components/InstallCard";
import { MoodPicker } from "../apps/habitfer/components/MoodPicker";
import { ProgressOrb } from "../apps/habitfer/components/ProgressOrb";
import { LevelBar } from "../apps/habitfer/components/StatsWidgets";
import { TodayTasks } from "../apps/habitfer/components/TodayTasks";
import { HABITS_CHANGED_EVENT } from "../apps/habitfer/effects";
import { apiErrorMessage, friendlyDay } from "../apps/habitfer/format";
import { setAppBadge } from "../apps/habitfer/pwa";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { useAchievements } from "../features/achievements/AchievementContext";
import { HabitCard } from "../features/habits/HabitCard";
import { countsForDay, isMeasurable, isQuit, isWeeklyCount } from "../features/habits/habitUtils";
import { useCelebrateLoaded, useHabitActions } from "../features/habits/useHabitActions";
import { WeekCalendarStrip } from "../features/habits/WeekCalendarStrip";
import { useIsMobile } from "../hooks/useIsMobile";
import type { CompleteHabitResponse, FreezeBalance, Habit, HabitToday, LevelInfo, OverviewPause, Task, TimeOfDay } from "../types";
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

/** Lo que no se pide hoy (en pausa o congelado y sin hacer) va al final de su seccion. */
function restLast(items: HabitToday[]): HabitToday[] {
  const resting = (h: HabitToday) => !h.completedToday && (Boolean(h.pausedUntil) || h.frozenToday);
  return [...items.filter((h) => !resting(h)), ...items.filter(resting)];
}

type OverviewBits = {
  progressByDate: Record<string, number>;
  perfectStreak: number;
  todayPerfect: boolean;
  level: LevelInfo | null;
  freezes: FreezeBalance | null;
  pause: OverviewPause | null;
  nextPause: OverviewPause | null;
};

export function TodayPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { celebrate, celebratePerfectDay } = useAchievements();
  const celebrateLoaded = useCelebrateLoaded();
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs());
  const [habits, setHabits] = useState<HabitToday[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mood, setMoodValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewBits | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [dayTarget, setDayTarget] = useState<HabitToday | null>(null);
  const [slideBack, setSlideBack] = useState(false);
  const [endingPause, setEndingPause] = useState(false);
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
        habitsRef.current = h;
        setHabits(h);
        celebrateLoaded(h);
        if (ov) {
          const map: Record<string, number> = {};
          for (const d of ov.habits.daily) map[d.date] = d.rate;
          const level = ov.habits.level ?? null;
          // Subio de nivel desde la ultima vez que se vio esta pantalla: tambien gano un congelador.
          if (level && lastLevelRef.current !== null && level.level > lastLevelRef.current) {
            message.open({
              type: "success",
              icon: <TrophyOutlined style={{ color: "var(--hf-ember)" }} />,
              content: `Subiste al nivel ${level.level} · ${level.title}. Ganaste un congelador ❄️`,
              duration: 5,
            });
          }
          if (level) lastLevelRef.current = level.level;
          setOverview({
            progressByDate: map,
            perfectStreak: ov.habits.perfectStreak ?? 0,
            todayPerfect: !!ov.habits.todayPerfect,
            level,
            freezes: ov.habits.freezes ?? null,
            pause: ov.habits.pause ?? null,
            nextPause: ov.habits.nextPause ?? null,
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
    [dateKey, celebrateLoaded],
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
  const daily = useMemo(() => habits.filter((h) => !isQuit(h) && !isWeeklyCount(h)), [habits]);
  const weekly = useMemo(() => habits.filter(isWeeklyCount), [habits]);
  const quitting = useMemo(() => habits.filter(isQuit), [habits]);
  const sections = useMemo(
    () =>
      order
        .map((m) => ({ moment: m, items: restLast(daily.filter((h) => (h.timeOfDay ?? "ANYTIME") === m)) }))
        .filter((s) => s.items.length > 0),
    [order, daily],
  );
  // Lo que cuenta para el dia, en el orden en que se ve.
  const counted = useMemo(
    () => [...sections.flatMap((s) => s.items), ...weekly].filter(countsForDay),
    [sections, weekly],
  );
  const showHeads =
    weekly.length > 0 || quitting.length > 0 || sections.length > 1 || (sections.length === 1 && sections[0].moment !== "ANYTIME");

  const doneCount = counted.filter((h) => h.completedToday).length;
  const total = counted.length;
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

  const maybeCelebratePerfectDay = useCallback(() => {
    const list = habitsRef.current.filter(countsForDay);
    if (dateKey !== dayjs().format("YYYY-MM-DD") || list.length === 0 || !list.every((h) => h.completedToday)) return;
    const ov = overviewRef.current;
    const streak = ov ? (ov.todayPerfect ? ov.perfectStreak : ov.perfectStreak + 1) : 1;
    celebratePerfectDay({ done: list.length, total: list.length, streak, colors: list.map((h) => h.color) });
  }, [dateKey, celebratePerfectDay]);

  const actions = useHabitActions<HabitToday>({
    itemsRef: habitsRef,
    setItems: setHabits,
    dateKey,
    canMark,
    onBecameDone: maybeCelebratePerfectDay,
    onSettled: () => void load({ silent: true }),
  });

  /** Guardar en la hoja del dia: cantidad o nota (puede cerrar el dia perfecto). */
  const onDaySaved = (habitId: string, result: CompleteHabitResponse) => {
    const wasDone = habitsRef.current.find((h) => h.id === habitId)?.completedToday;
    if (result.unlockedAchievement) celebrate(result.unlockedAchievement);
    if (result.challengeWon) celebrate(result.challengeWon);
    const nowDone = result.done ?? true;
    if (nowDone) {
      const next = habitsRef.current.map((h) => (h.id === habitId ? { ...h, completedToday: true } : h));
      habitsRef.current = next;
      setHabits(next);
      if (!wasDone) maybeCelebratePerfectDay();
    }
    void load({ silent: true });
  };

  const onFreezeChange = (balance: FreezeBalance) => {
    setOverview((ov) => (ov ? { ...ov, freezes: balance } : ov));
    void load({ silent: true });
  };

  const finishPause = async () => {
    if (!overview?.pause) return;
    setEndingPause(true);
    try {
      await endPause(overview.pause.id);
      message.success("Pausa terminada: de vuelta a la carga");
      await load({ silent: true });
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo terminar la pausa"));
    } finally {
      setEndingPause(false);
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
    navigate(`/app/habitfer/habits/${habit.id}`, { viewTransition: true, state: { habit } });
  };
  const openDay = (habit: HabitToday | Habit) => {
    const h = habits.find((x) => x.id === habit.id);
    if (h) setDayTarget(h);
  };
  const openAchievements = () => navigate("/app/habitfer/logros", { viewTransition: true });

  const weekday = selectedDate.format("dddd");
  const kicker = isToday
    ? `Hoy · ${weekday}`
    : isYesterday
      ? `Ayer · ${weekday}`
      : weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const riskWindow = isToday && now.hour() >= 20;
  const freezes = overview?.freezes?.available ?? null;

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
          segments={counted.map((h) => ({
            id: h.id,
            color: h.color,
            progress: h.completedToday ? 1 : isMeasurable(h) ? Math.min(1, h.valueToday / Math.max(1, h.goal)) : 0,
          }))}
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
          <div className="hf-orb-links">
            <button type="button" className="hf-link" onClick={openAchievements}>
              Ver logros
            </button>
            {freezes !== null && (
              <span className="hf-freeze-count" title="Congeladores: guardan tu racha un día que no puedas. Mantén presionado un hábito para usarlos.">
                ❄️ {freezes}
              </span>
            )}
          </div>
        </div>
      </div>
    );

  const pauseBanner =
    isToday && overview?.pause ? (
      <div className="hf-pause-banner">
        <span className="hf-pause-banner__icon" aria-hidden="true">
          🌴
        </span>
        <div>
          <b>En pausa hasta {friendlyDay(overview.pause.endDate, todayKey)}</b>
          <span>
            {overview.pause.note ? `${overview.pause.note} · ` : ""}Tus rachas están a salvo. Si haces algo, igual cuenta.
          </span>
        </div>
        <Button size="small" loading={endingPause} onClick={() => void finishPause()}>
          Terminar
        </Button>
      </div>
    ) : isToday && overview?.nextPause ? (
      <p className="hf-hint" style={{ marginTop: 0 }}>
        🌴 Pausa programada desde {friendlyDay(overview.nextPause.startDate, todayKey)} hasta{" "}
        {friendlyDay(overview.nextPause.endDate, todayKey)}.
      </p>
    ) : null;

  const card = (habit: HabitToday) => (
    <HabitCard
      key={habit.id}
      habit={habit}
      canToggle={canMark}
      riskWindow={riskWindow}
      onToggle={(h) => actions.press(h as HabitToday)}
      onOpen={openDetail}
      onEdit={openEdit}
      onNote={canMark && !isQuit(habit) ? openDay : undefined}
      onRelapse={canMark ? (h) => actions.relapse(h as HabitToday) : undefined}
    />
  );
  const listClass = `hf-list${isMobile ? "" : " hf-list--grid"}`;

  const list =
    loading && habits.length === 0 ? (
      <div className="hf-list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="hf-skel hf-skel--card" />
        ))}
      </div>
    ) : habits.length === 0 ? (
      <div className="hf-empty">
        <b>Nada programado para este día</b>
        <p style={{ margin: "0 0 16px" }}>Crea un hábito, o empieza con una plantilla, y enciende tu primera racha.</p>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Crear hábito
        </Button>
      </div>
    ) : (
      <div key={dateKey} className={`hf-day-in${slideBack ? " hf-day-in--back" : ""}`}>
        {!canMark && (
          <p style={{ color: "var(--hf-muted)", fontSize: 13, margin: "0 4px 12px" }}>Solo lectura: puedes marcar hábitos de hoy o de ayer.</p>
        )}
        {sections.map((s) => (
          <section key={s.moment} className="hf-section">
            {showHeads && (
              <div className="hf-section__head">
                <span>{MOMENTS[s.moment].label}</span>
                {isToday && s.moment === momentNow(now) ? (
                  <em>ahora</em>
                ) : (
                  <span style={{ textTransform: "none", letterSpacing: 0 }}>{MOMENTS[s.moment].hint}</span>
                )}
              </div>
            )}
            <div className={listClass}>{s.items.map(card)}</div>
          </section>
        ))}
        {weekly.length > 0 && (
          <section className="hf-section">
            <div className="hf-section__head">
              <span>Esta semana</span>
              <span style={{ textTransform: "none", letterSpacing: 0 }}>el día que quieras</span>
            </div>
            <div className={listClass}>{weekly.map(card)}</div>
          </section>
        )}
        {quitting.length > 0 && (
          <section className="hf-section">
            <div className="hf-section__head">
              <span>Dejando</span>
              <span style={{ textTransform: "none", letterSpacing: 0 }}>días limpio</span>
            </div>
            <div className={listClass}>{quitting.map(card)}</div>
          </section>
        )}
        {canMark && !hasNotes && daily.length + weekly.length > 0 && (
          <p className="hf-hint">
            {isMobile ? "Mantén presionado un hábito" : "Haz clic derecho en un hábito"} para la nota del día, la cantidad o un congelador.
          </p>
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
          {pauseBanner}
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
            {pauseBanner}
            {list}
          </section>
        </div>
      )}

      <HabitEditorDrawer open={editorOpen} habit={editing} onClose={() => setEditorOpen(false)} onSaved={() => void load()} />
      <DaySheet
        open={dayTarget !== null}
        habit={dayTarget}
        date={dateKey}
        freezesAvailable={freezes}
        onClose={() => setDayTarget(null)}
        onSaved={(result) => dayTarget && onDaySaved(dayTarget.id, result)}
        onFreezeChange={onFreezeChange}
      />
    </div>
  );
}
