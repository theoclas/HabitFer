import { ArrowLeftOutlined, CaretRightOutlined, CheckOutlined, EditOutlined, FormOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Modal, Select, Skeleton, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  endPause,
  fetchFreezes,
  fetchHabit,
  fetchHabitAchievements,
  fetchStatsRange,
  freezeHabitDay,
  removeRelapse,
  unfreezeHabitDay,
  updateHabit,
} from "../api/client";
import { DaySheet } from "../apps/habitfer/components/DaySheet";
import { Flame, flameStage } from "../apps/habitfer/components/Flame";
import { MonthCalendar } from "../apps/habitfer/components/MonthCalendar";
import { PauseSheet } from "../apps/habitfer/components/PauseSheet";
import { WeekdayBars } from "../apps/habitfer/components/StatsWidgets";
import { YearHeatmap } from "../apps/habitfer/components/YearHeatmap";
import { burstSparks, buzz, HABITS_CHANGED_EVENT, playTick } from "../apps/habitfer/effects";
import { canFocus, startFocus } from "../apps/habitfer/focus";
import { apiErrorMessage, fmtInt, friendlyDay } from "../apps/habitfer/format";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { useAchievements } from "../features/achievements/AchievementContext";
import { getNextMilestone } from "../features/achievements/milestones";
import { HABIT_HERO_TRANSITION } from "../features/habits/HabitCard";
import {
  amountLabel,
  habitEmoji,
  habitScheduleLabel,
  isMeasurable,
  isQuit,
  isWeeklyCount,
  streakLabel,
  streakStageDays,
  unitFor,
} from "../features/habits/habitUtils";
import { useCelebrateLoaded, useHabitActions } from "../features/habits/useHabitActions";
import type { FreezeBalance, Habit, HabitAchievementRow, StatsRange } from "../types";
import { todayKey } from "../utils/dates";

const TIME_LABEL: Record<Habit["timeOfDay"], string> = {
  ANYTIME: "",
  MORNING: "Mañana",
  AFTERNOON: "Tarde",
  EVENING: "Noche",
};

const CHALLENGE_DAYS = [7, 14, 21, 30, 60, 90, 100];
const FREEZE_WINDOW_DAYS = 7;

function milestoneLabel(d: number) {
  if (d === 3) return "Primer paso";
  if (d === 5) return "Constancia inicial";
  if (d === 10) return "Una semana y más";
  if (d <= 50) return `${d} días seguidos`;
  return `${d} días de disciplina`;
}

/** Dias (claves) de unas pausas, con tope por pausa. */
function pauseKeys(pauses: { startKey: string; endKey: string }[]): Set<string> {
  const out = new Set<string>();
  for (const p of pauses) {
    let d = dayjs(p.startKey);
    for (let i = 0; i < 120 && d.format("YYYY-MM-DD") <= p.endKey; i++) {
      out.add(d.format("YYYY-MM-DD"));
      d = d.add(1, "day");
    }
  }
  return out;
}

export function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { celebrate } = useAchievements();
  const celebrateLoaded = useCelebrateLoaded();
  const fromList = (location.state as { habit?: Habit } | null)?.habit;
  const [habit, setHabit] = useState<Habit | null>(fromList && fromList.id === id ? fromList : null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(() => dayjs().year());
  const [month, setMonth] = useState<Dayjs>(() => dayjs().startOf("month"));
  const [yearData, setYearData] = useState<StatsRange | null>(null);
  const [last30, setLast30] = useState<StatsRange | null>(null);
  const [achievements, setAchievements] = useState<HabitAchievementRow[]>([]);
  const [freezes, setFreezes] = useState<FreezeBalance | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeDays, setChallengeDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const yearRef = useRef(year);
  yearRef.current = year;
  const itemsRef = useRef<Habit[]>([]);
  itemsRef.current = habit ? [habit] : [];

  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/app/habitfer/habits", { viewTransition: true });
  };

  const loadYear = useCallback(
    (habitId: string, y: number) =>
      fetchStatsRange({ from: `${y}-01-01`, to: `${y}-12-31`, habitId })
        .then((d) => {
          if (yearRef.current === y) setYearData(d);
        })
        .catch(() => undefined),
    [],
  );

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!id) return;
      if (!opts?.quiet) setLoading(true);
      try {
        const [h, l30, ach, fz] = await Promise.all([
          fetchHabit(id),
          fetchStatsRange({ habitId: id }).catch(() => null),
          fetchHabitAchievements(id).catch(() => [] as HabitAchievementRow[]),
          fetchFreezes().catch(() => null),
        ]);
        setHabit(h);
        celebrateLoaded([h]);
        setLast30(l30);
        setAchievements(ach);
        setFreezes(fz);
        if (opts?.quiet) void loadYear(id, yearRef.current);
      } catch {
        if (!opts?.quiet) {
          message.error("Habito no encontrado");
          navigate("/app/habitfer/habits");
        }
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [id, navigate, celebrateLoaded, loadYear],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Lo que se marque desde otra parte (enfoque, paleta, otra pestaña) se refleja aquí.
  useEffect(() => {
    const onChanged = () => void load({ quiet: true });
    window.addEventListener(HABITS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(HABITS_CHANGED_EVENT, onChanged);
  }, [load]);

  useEffect(() => {
    if (!id) return;
    setYearData(null);
    void loadYear(id, year);
  }, [id, year, loadYear]);

  const actions = useHabitActions<Habit>({
    itemsRef,
    setItems: (list) => setHabit(list[0] ?? null),
    dateKey: todayKey(),
    canMark: true,
    onSettled: () => void load({ quiet: true }),
  });

  const byDate = useMemo(() => new Map((yearData?.days ?? []).map((d) => [d.date, d])), [yearData]);
  const notes = useMemo(() => new Map((habit?.recentNotes ?? []).map((n) => [n.date, n.note])), [habit?.recentNotes]);
  const noteDates = useMemo(() => new Set(notes.keys()), [notes]);
  const frozenSet = useMemo(() => new Set(habit?.freezeDates ?? []), [habit?.freezeDates]);
  const pausedSet = useMemo(() => pauseKeys(habit?.pauses ?? []), [habit?.pauses]);
  const amounts = useMemo(() => new Map((habit?.amounts ?? []).map((a) => [a.date, a.value])), [habit?.amounts]);

  const changeYear = (y: number) => {
    setYear(y);
    setMonth(y === dayjs().year() ? dayjs().startOf("month") : dayjs(`${y}-12-01`));
  };
  const changeMonth = (delta: number) => {
    const next = month.add(delta, "month");
    setMonth(next);
    if (next.year() !== year) setYear(next.year());
  };

  if (!habit) {
    return loading ? <Skeleton active paragraph={{ rows: 6 }} /> : null;
  }

  const quit = isQuit(habit);
  const measurable = isMeasurable(habit);
  const weekly = isWeeklyCount(habit);
  const unit = habit.streakUnit ?? "days";
  const stage = flameStage(streakStageDays(habit.currentStreak, unit));
  const momento = TIME_LABEL[habit.timeOfDay ?? "ANYTIME"];
  const hasStreak = quit || habit.streakEnabled;
  const next = hasStreak ? getNextMilestone(habit.currentStreak) : null;
  const minYear = dayjs(quit && habit.startDate ? habit.startDate : habit.createdAt).year();
  const notesList = habit.recentNotes ?? [];
  const today = todayKey();
  const ownPause = (habit.pauses ?? []).find((p) => p.habitId === habit.id && p.endKey >= today) ?? null;
  const generalPause = (habit.pauses ?? []).find((p) => p.habitId === null && p.startKey <= today && today <= p.endKey) ?? null;
  const challenge = habit.challenge;
  const relapses = habit.relapses ?? [];

  const press = (e: MouseEvent<HTMLElement>) => {
    if (!habit.completedToday) {
      burstSparks(e.currentTarget, habit.color);
      buzz();
      playTick();
    }
    void actions.toggle(habit);
  };

  const stepBy = (delta: number, e?: MouseEvent<HTMLElement>) => {
    const value = Math.max(0, habit.valueToday + delta);
    if (e && !habit.completedToday && value >= habit.goal) {
      burstSparks(e.currentTarget, habit.color);
      buzz();
      playTick();
    } else {
      buzz(6);
    }
    actions.setValue(habit, value);
  };

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(true);
    try {
      await fn();
      message.success(ok);
      await load({ quiet: true });
    } catch (err) {
      message.error(apiErrorMessage(err, fail));
    } finally {
      setBusy(false);
    }
  };

  const startChallenge = () =>
    run(() => updateHabit(habit.id, { challengeDays, challengeStart: today }), `Reto de ${challengeDays} días: ¡arrancamos!`, "No se pudo empezar el reto").then(
      () => setChallengeOpen(false),
    );
  const restartChallenge = () =>
    challenge && run(() => updateHabit(habit.id, { challengeDays: challenge.days, challengeStart: today }), "Reto reiniciado desde hoy", "No se pudo reiniciar");
  const dropChallenge = () =>
    Modal.confirm({
      title: "¿Quitar el reto?",
      content: "El hábito sigue igual; solo se borra la meta con fecha final.",
      okText: "Quitar",
      cancelText: "Cancelar",
      onOk: () => run(() => updateHabit(habit.id, { challengeDays: null }), "Reto quitado", "No se pudo quitar"),
    });

  /** Congelar o descongelar un dia desde el calendario. */
  const freezeAction = (key: string) => {
    if (quit || weekly || !habit.streakEnabled) return null;
    const daysAgo = dayjs().startOf("day").diff(dayjs(key), "day");
    if (daysAgo < 0 || daysAgo > FREEZE_WINDOW_DAYS) return null;
    const d = byDate.get(key);
    if (d?.completed) return null;
    if (frozenSet.has(key)) {
      return (
        <Button size="small" loading={busy} onClick={() => void run(() => unfreezeHabitDay(habit.id, key), "El congelador volvió a tu saldo", "No se pudo quitar")}>
          Quitar congelador
        </Button>
      );
    }
    if (!d || d.scheduled === 0) return null;
    const left = freezes?.available ?? 0;
    return (
      <Button
        size="small"
        loading={busy}
        disabled={left === 0}
        onClick={() => void run(() => freezeHabitDay(habit.id, key), "Día congelado: tu racha está a salvo ❄️", "No se pudo congelar")}
      >
        ❄️ Congelar este día{freezes ? ` (te quedan ${left})` : ""}
      </Button>
    );
  };

  const subLine = [
    habitScheduleLabel(habit),
    momento,
    !quit && habit.reminderEnabled && (habit.reminderTimes?.length || habit.reminderTime)
      ? `aviso ${(habit.reminderTimes?.length ? habit.reminderTimes : [habit.reminderTime]).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

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
            <div className="hf-detail-hero__sub">{subLine}</div>
          </div>
        </div>

        {hasStreak && (
          <div className="hf-detail-hero__streak">
            {stage && <Flame stage={stage} size={54} glow />}
            <span className="hf-detail-hero__big">{habit.currentStreak}</span>
            <span className="hf-detail-hero__lab">
              <b>
                {quit
                  ? habit.currentStreak === 1
                    ? "día limpio"
                    : "días limpio"
                  : unit === "weeks"
                    ? habit.currentStreak === 1
                      ? "semana de racha"
                      : "semanas de racha"
                    : habit.currentStreak === 1
                      ? "día de racha"
                      : "días de racha"}
              </b>
              {quit
                ? habit.relapsedToday
                  ? "Hoy anotaste una recaída: mañana empieza otra cuenta"
                  : `${stage ? stage.name + " · " : ""}desde ${dayjs(relapses[0]?.date ? dayjs(relapses[0].date).add(1, "day") : habit.startDate).format("D [de] MMMM")}`
                : stage
                  ? stage.name
                  : weekly
                    ? "Cumple la meta de esta semana para encenderla"
                    : "Marca hoy para encenderla"}
              {next ? ` · próximo logro a ${quit ? `los ${next} días` : unit === "weeks" ? `las ${next} semanas` : `los ${next}`}` : ""}
            </span>
          </div>
        )}

        <div className="hf-detail-hero__stats hf-detail-hero__stats--3">
          <div>
            <b>{habit.longestStreak}</b>
            <span>{quit ? "mejor marca" : unit === "weeks" ? "mejor racha (sem)" : "mejor racha"}</span>
          </div>
          <div>
            <b>{quit ? fmtInt(relapses.length) : habit.totalCompletions !== undefined ? fmtInt(habit.totalCompletions) : "—"}</b>
            <span>{quit ? (relapses.length === 1 ? "recaída" : "recaídas") : "veces en total"}</span>
          </div>
          <div>
            <b>{last30 ? `${last30.totals.rate} %` : "—"}</b>
            <span>{quit ? "limpio en 30 días" : "últimos 30 días"}</span>
          </div>
        </div>

        {quit ? (
          <div className="hf-detail-hero__actions">
            {habit.relapsedToday ? (
              <Button size="large" onClick={() => void run(() => removeRelapse(habit.id, today), "Recaída borrada", "No se pudo borrar")} loading={busy} style={{ flex: 1 }}>
                Hoy anotaste una recaída · deshacer
              </Button>
            ) : (
              <Button size="large" danger onClick={() => actions.relapse(habit)} style={{ flex: 1 }}>
                Registrar recaída
              </Button>
            )}
          </div>
        ) : (
          habit.scheduledToday && (
            <>
              {measurable ? (
                <div className="hf-detail-stepper">
                  <button type="button" aria-label="Restar" disabled={habit.valueToday <= 0} onClick={() => stepBy(-Math.max(1, habit.step))}>
                    <MinusOutlined />
                  </button>
                  <div>
                    <b>{amountLabel(habit.valueToday, habit.goal, habit.unit)}</b>
                    <span>{habit.completedToday ? "meta cumplida hoy" : `cada toque suma ${habit.step} ${unitFor(habit.step, habit.unit)}`.trim()}</span>
                    <i className="hf-stepper__bar" aria-hidden="true">
                      <em style={{ width: `${Math.min(100, Math.round((habit.valueToday / Math.max(1, habit.goal)) * 100))}%` }} />
                    </i>
                  </div>
                  <button type="button" aria-label="Sumar" onClick={(e) => stepBy(Math.max(1, habit.step), e)}>
                    <PlusOutlined />
                  </button>
                </div>
              ) : null}
              <div className="hf-detail-hero__actions">
                {!measurable && (
                  <Button
                    type={habit.completedToday ? "default" : "primary"}
                    size="large"
                    icon={<CheckOutlined />}
                    onClick={(e) => press(e)}
                    style={{ flex: 1 }}
                  >
                    {habit.completedToday ? "Hecho hoy · desmarcar" : "Marcar hoy"}
                  </Button>
                )}
                {measurable && canFocus(habit) && (
                  <Button type="primary" size="large" icon={<CaretRightOutlined />} onClick={() => startFocus(habit)} style={{ flex: 1 }}>
                    Enfoque
                  </Button>
                )}
                <Button size="large" icon={<FormOutlined />} onClick={() => setDayOpen(true)} aria-label="Tu día con este hábito" style={measurable ? { flex: 1 } : undefined}>
                  {measurable ? (canFocus(habit) ? "Cantidad o nota" : "Escribir cantidad o nota") : habit.note ? "Editar nota" : "Nota"}
                </Button>
              </div>
              {weekly && (
                <p className="hf-detail-hero__note">
                  Esta semana: {habit.weekDone ?? 0} de {habit.weeklyTarget ?? 3}
                  {(habit.weekDone ?? 0) >= (habit.weeklyTarget ?? 3) ? " · semana cumplida 🔥" : ""}
                </p>
              )}
              {habit.frozenToday && !habit.completedToday && <p className="hf-detail-hero__note">❄️ Hoy está congelado: no rompe tu racha.</p>}
            </>
          )
        )}
        {(ownPause || generalPause) && !habit.completedToday && !quit && (
          <p className="hf-detail-hero__note">
            ⏸ En pausa hasta {friendlyDay((ownPause ?? generalPause)!.endKey, today)}
            {(ownPause ?? generalPause)!.note ? ` · ${(ownPause ?? generalPause)!.note}` : ""}
          </p>
        )}
      </section>

      {habit.description && <p style={{ color: "var(--hf-muted)", margin: "0 4px 18px" }}>{habit.description}</p>}

      <section className="hf-panel hf-challenge">
        <div className="hf-panel__head">
          <h2>{challenge ? `Reto de ${challenge.days} días` : "Reto"}</h2>
          {challenge && challenge.status !== "broken" && (
            <span>
              {challenge.status === "upcoming"
                ? `empieza ${friendlyDay(challenge.startKey, today)}`
                : challenge.remaining === 1
                  ? "último día"
                  : `faltan ${challenge.remaining} días`}
            </span>
          )}
        </div>
        {challenge ? (
          <>
            <div className={`hf-challenge__bar${challenge.status === "broken" ? " is-broken" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={challenge.total} aria-valuenow={challenge.done}>
              <i style={{ width: `${Math.round((challenge.done / Math.max(1, challenge.total)) * 100)}%` }} />
            </div>
            <p className="hf-note">
              {challenge.status === "broken"
                ? `Se rompió ${challenge.brokenOn ? friendlyDay(challenge.brokenOn, today) : ""}. Pasa: reinícialo y va de nuevo.`
                : challenge.status === "upcoming"
                  ? `Arranca el ${dayjs(challenge.startKey).format("D [de] MMMM")} y termina el ${dayjs(challenge.endKey).format("D [de] MMMM")}.`
                  : quit
                    ? `Día ${challenge.dayIndex} de ${challenge.days} · ${challenge.done} días limpio de ${challenge.total}`
                    : weekly
                      ? `Día ${challenge.dayIndex} de ${challenge.days} · ${challenge.done} de ${challenge.total} veces`
                      : `Día ${challenge.dayIndex} de ${challenge.days} · ${challenge.done} de ${challenge.total} días cumplidos`}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {challenge.status === "broken" && (
                <Button type="primary" loading={busy} onClick={() => void restartChallenge()}>
                  Reiniciar desde hoy
                </Button>
              )}
              <Button loading={busy} onClick={dropChallenge}>
                Quitar reto
              </Button>
            </div>
          </>
        ) : (
          <div className="hf-challenge__empty">
            <p className="hf-note" style={{ margin: 0 }}>
              Una meta con fecha final: {quit ? "días sin recaer" : "cumplir cada día que toca"}, cuenta regresiva y medalla al terminar.
            </p>
            <Button onClick={() => setChallengeOpen(true)}>Empezar un reto</Button>
          </div>
        )}
        {(habit.challengeWins?.length ?? 0) > 0 && (
          <div className="hf-challenge__wins">
            {habit.challengeWins!.map((w) => (
              <span key={w.id} className="hf-challenge__win" title={`Del ${dayjs(w.startDate).format("D MMM")} al ${dayjs(w.endDate).format("D MMM YYYY")}`}>
                🏁 {w.days} días · {dayjs(w.endDate).format("MMM YYYY")}
              </span>
            ))}
          </div>
        )}
      </section>

      {!quit && (
        <section className="hf-panel hf-pause-panel">
          <div className="hf-panel__head">
            <h2>Pausa</h2>
            {ownPause && <span>{ownPause.startKey > today ? `desde ${friendlyDay(ownPause.startKey, today)}` : "activa"}</span>}
          </div>
          {ownPause ? (
            <div className="hf-challenge__empty">
              <p className="hf-note" style={{ margin: 0 }}>
                {ownPause.startKey > today ? "Programada" : "En pausa"} hasta {friendlyDay(ownPause.endKey, today)}
                {ownPause.note ? ` · ${ownPause.note}` : ""}. Esos días no se piden y la racha no se rompe.
              </p>
              <Button loading={busy} onClick={() => void run(() => endPause(ownPause.id), ownPause.startKey > today ? "Pausa cancelada" : "Pausa terminada", "No se pudo terminar")}>
                {ownPause.startKey > today ? "Cancelar pausa" : "Reanudar"}
              </Button>
            </div>
          ) : (
            <div className="hf-challenge__empty">
              <p className="hf-note" style={{ margin: 0 }}>
                ¿Viaje o enfermedad? Pausa este hábito unos días sin perder la racha.
                {generalPause ? ` Ahora mismo hay una pausa general hasta ${friendlyDay(generalPause.endKey, today)}.` : ""}
              </p>
              <Button onClick={() => setPauseOpen(true)}>Pausar</Button>
            </div>
          )}
        </section>
      )}

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

      {quit && relapses.length > 0 && (
        <section className="hf-panel">
          <div className="hf-panel__head">
            <h2>Recaídas</h2>
            <span>{relapses.length === 1 ? "1 en total" : `${relapses.length} en total`}</span>
          </div>
          <ul className="hf-relapse-list">
            {relapses.slice(0, 12).map((r) => (
              <li key={r.date}>
                <span>
                  <b>{dayjs(r.date).format("dddd D [de] MMMM")}</b>
                  {r.note ? <small>«{r.note}»</small> : null}
                </span>
                <Button size="small" type="text" onClick={() => void run(() => removeRelapse(habit.id, r.date), "Recaída borrada", "No se pudo borrar")}>
                  Borrar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="hf-panel">
        <div className="hf-panel__head">
          <h2>{quit ? "Tu año limpio" : "Tu año con este hábito"}</h2>
          {noteDates.size > 0 && <span>punto = nota</span>}
        </div>
        <YearHeatmap year={year} days={yearData?.days ?? null} mode="habit" color={habit.color} minYear={minYear} onYearChange={changeYear} noteDates={noteDates} quit={quit} />
      </section>

      <div className="hf-grid2">
        <section className="hf-panel">
          <div className="hf-panel__head">
            <h2>Mes a mes</h2>
            {!quit && !weekly && habit.streakEnabled && freezes && <span title="Toca un día pendiente para congelarlo">❄️ {freezes.available}</span>}
          </div>
          <MonthCalendar
            month={month}
            byDate={byDate}
            color={habit.color}
            notes={notes}
            canPrev={month.isAfter(dayjs(quit && habit.startDate ? habit.startDate : habit.createdAt).startOf("month"), "month")}
            onPrev={() => changeMonth(-1)}
            onNext={() => changeMonth(1)}
            frozen={frozenSet}
            paused={pausedSet}
            quit={quit}
            amounts={measurable ? amounts : undefined}
            amountText={measurable ? (v) => amountLabel(v, habit.goal, habit.unit) : undefined}
            renderAction={freezeAction}
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
                aria-label={`${a.headline ?? `${a.milestoneDays} días`}, ver frase`}
                onClick={() =>
                  celebrate(
                    {
                      ...a,
                      habitTitle: habit.title,
                      habitColor: habit.color,
                      habitIcon: habit.icon,
                      label: a.label ?? milestoneLabel(a.milestoneDays),
                    },
                    { replay: true },
                  )
                }
              >
                <span className="hf-medal" style={{ "--m": flameStage(streakStageDays(a.milestoneDays, unit))?.outer } as CSSProperties}>
                  {habitEmoji(habit.icon)}
                  <b>{a.milestoneDays}</b>
                </span>
              </button>
            ))}
            {next && (
              <span className="hf-medal-cell" title={`Faltan ${streakLabel(next - habit.currentStreak, quit ? "days" : unit)}`}>
                <span className="hf-medal hf-medal--locked">
                  {habitEmoji(habit.icon)}
                  <b>{next}</b>
                </span>
              </span>
            )}
          </div>
        )}
      </section>

      <HabitEditorDrawer open={editorOpen} habit={habit} onClose={() => setEditorOpen(false)} onSaved={() => void load({ quiet: true })} />
      <DaySheet
        open={dayOpen}
        habit={habit}
        date={today}
        freezesAvailable={freezes?.available ?? null}
        onClose={() => setDayOpen(false)}
        onSaved={(result) => {
          if (result.unlockedAchievement) celebrate(result.unlockedAchievement);
          if (result.challengeWon) celebrate(result.challengeWon);
          setHabit(result.habit);
          void load({ quiet: true });
        }}
        onFreezeChange={(balance, h) => {
          setFreezes(balance);
          setHabit(h);
        }}
      />
      <PauseSheet open={pauseOpen} habit={habit} onClose={() => setPauseOpen(false)} onCreated={() => void load({ quiet: true })} />
      <Modal
        open={challengeOpen}
        onCancel={() => setChallengeOpen(false)}
        centered
        width={400}
        title="Empezar un reto"
        okText={`Empezar hoy`}
        cancelText="Cancelar"
        confirmLoading={busy}
        onOk={() => void startChallenge()}
      >
        <p className="hf-hint" style={{ marginTop: 0 }}>
          {quit
            ? "Cuántos días seguidos sin recaer. Al terminar ganas una medalla especial."
            : "Cumplir cada día que toca durante el reto. Al terminar ganas una medalla especial."}
        </p>
        <Select
          size="large"
          style={{ width: "100%" }}
          value={challengeDays}
          onChange={setChallengeDays}
          options={CHALLENGE_DAYS.map((d) => ({ value: d, label: `${d} días · hasta el ${dayjs().add(d - 1, "day").format("D [de] MMMM")}` }))}
        />
      </Modal>
    </div>
  );
}
