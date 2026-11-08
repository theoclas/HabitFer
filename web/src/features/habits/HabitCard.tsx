import { CaretRightOutlined, EditOutlined, FormOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { Flame, StreakChip } from "../../apps/habitfer/components/Flame";
import { burstSparks, buzz, playTick } from "../../apps/habitfer/effects";
import { canFocus } from "../../apps/habitfer/focus";
import type { Habit, HabitToday } from "../../types";
import {
  amountLabel,
  habitEmoji,
  habitScheduleLabel,
  isMeasurable,
  isQuit,
  isWeeklyCount,
  streakStageDays,
} from "./habitUtils";

type Props = {
  habit: Habit | HabitToday;
  /** Se acepta por compatibilidad; el check ya es optimista y no se bloquea. */
  loading?: boolean;
  canToggle?: boolean;
  /** Muestra la racha "en riesgo" (de noche, si el habito sigue pendiente). */
  riskWindow?: boolean;
  layout?: "list" | "grid";
  /** Toque principal: marca o desmarca; en los medibles suma. */
  onToggle: (habit: Habit | HabitToday) => void | Promise<void>;
  onOpen?: (habit: Habit | HabitToday) => void;
  onEdit?: (habit: Habit | HabitToday) => void;
  /** Mantener presionada la tarjeta (o clic derecho) abre el dia: cantidad, nota y congelador. */
  onNote?: (habit: Habit | HabitToday) => void;
  /** Dejar algo: registrar una recaida. */
  onRelapse?: (habit: Habit | HabitToday) => void;
  /** Temporizador de enfoque (medibles en minutos). */
  onFocus?: (habit: Habit | HabitToday) => void;
};

/** Nombre compartido con la cabecera del detalle para la transicion entre pantallas. */
export const HABIT_HERO_TRANSITION = "hf-habit-hero";

const LONG_PRESS_MS = 520;
const RING = 2 * Math.PI * 15.5;

export function HabitCard({ habit, loading, canToggle = true, riskWindow = false, onToggle, onOpen, onEdit, onNote, onRelapse, onFocus }: Props) {
  const quit = isQuit(habit);
  const measurable = isMeasurable(habit);
  const weekly = isWeeklyCount(habit);
  const completed = habit.completedToday;
  const paused = Boolean(habit.pausedUntil) && !quit;
  const frozen = habit.frozenToday;
  const atRisk = riskWindow && !completed && habit.requiredToday && habit.streakEnabled && habit.currentStreak >= 3;
  const note = "note" in habit ? habit.note : null;
  const [justDone, setJustDone] = useState(false);
  const prevCompleted = useRef(completed);
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);

  // Animacion de "encendido" solo cuando pasa de pendiente a hecho mientras se ve la tarjeta.
  useEffect(() => {
    if (!prevCompleted.current && completed) {
      setJustDone(true);
      const t = window.setTimeout(() => setJustDone(false), 900);
      prevCompleted.current = completed;
      return () => window.clearTimeout(t);
    }
    prevCompleted.current = completed;
    return undefined;
  }, [completed]);

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onNote || (e.pointerType === "mouse" && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest("button")) return;
    cancelPress();
    const state = { timer: 0, x: e.clientX, y: e.clientY, fired: false };
    state.timer = window.setTimeout(() => {
      state.fired = true;
      buzz(20);
      onNote(habit);
    }, LONG_PRESS_MS);
    press.current = state;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress();
  };

  const open = (el: HTMLElement) => {
    if (press.current?.fired) {
      press.current = null;
      return;
    }
    if (!onOpen) return;
    el.style.setProperty("view-transition-name", HABIT_HERO_TRANSITION);
    onOpen(habit);
  };

  const handleToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!canToggle || loading) return;
    if (measurable) {
      const reaches = !completed && habit.valueToday + Math.max(1, habit.step) >= habit.goal;
      if (reaches) {
        burstSparks(e.currentTarget, habit.color);
        buzz();
        playTick();
      } else {
        buzz(8);
      }
    } else if (!completed) {
      burstSparks(e.currentTarget, habit.color);
      buzz();
      playTick();
    }
    void onToggle(habit);
  };

  const classes = [
    "hf-card",
    quit ? "hf-card--quit" : "",
    completed ? "is-done" : "",
    atRisk ? "is-risk" : "",
    justDone ? "just-done" : "",
    paused && !completed ? "is-paused" : "",
    frozen && !completed ? "is-frozen" : "",
    quit && habit.relapsedToday ? "is-relapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const challenge = habit.challenge;
  const challengePct = challenge ? Math.round((challenge.done / Math.max(1, challenge.total)) * 100) : 0;
  const ringPct = measurable ? Math.min(1, habit.valueToday / Math.max(1, habit.goal)) : 0;
  const pausedLabel = habit.pausedUntil ? dayjs(habit.pausedUntil).format("D MMM") : "";

  const label = quit
    ? `${habit.title}, ${habit.currentStreak} días limpio`
    : `${habit.title}${completed ? ", hecho" : measurable ? `, ${amountLabel(habit.valueToday, habit.goal, habit.unit)}` : ""}`;

  return (
    <div
      role="button"
      tabIndex={0}
      className={classes}
      style={{ "--c": habit.color } as CSSProperties}
      onClick={(e) => open(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) open(e.currentTarget);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => {
        if (!onNote) return;
        e.preventDefault();
        cancelPress();
        onNote(habit);
      }}
      aria-label={label}
    >
      <span className="hf-card__emoji" aria-hidden="true">
        {habitEmoji(habit.icon)}
      </span>
      <span className="hf-card__body">
        <span className="hf-card__title">{habit.title}</span>
        <span className="hf-card__meta">
          {quit ? (
            habit.relapsedToday ? (
              <span className="hf-card__risk">recaída hoy</span>
            ) : (
              <span className="hf-clean">
                {habit.currentStreak > 0 && <Flame days={habit.currentStreak} size={13} />}
                <b>{habit.currentStreak}</b> {habit.currentStreak === 1 ? "día limpio" : "días limpio"}
              </span>
            )
          ) : (
            <>
              {habit.streakEnabled && habit.currentStreak > 0 && (
                <StreakChipFor n={habit.currentStreak} weeks={habit.streakUnit === "weeks"} />
              )}
              {atRisk && <span className="hf-card__risk">en riesgo</span>}
              {habit.autoSource && (
                <span className="hf-card__auto" title="Se marca solo con lo que anotas en NutriFer">
                  🥑 NutriFer
                </span>
              )}
              {weekly ? (
                <span className={`hf-week-chip${(habit.weekDone ?? 0) >= (habit.weeklyTarget ?? 3) ? " is-met" : ""}`}>
                  {(habit.weekDone ?? 0) >= (habit.weeklyTarget ?? 3)
                    ? "semana cumplida"
                    : `${habit.weekDone ?? 0}/${habit.weeklyTarget ?? 3} esta semana`}
                </span>
              ) : measurable ? (
                <span className="hf-card__amount">{amountLabel(habit.valueToday, habit.goal, habit.unit)}</span>
              ) : (
                !paused && !frozen && <span>{habitScheduleLabel(habit)}</span>
              )}
            </>
          )}
          {paused && !completed && <span className="hf-card__paused">en pausa hasta {pausedLabel}</span>}
          {frozen && !completed && <span className="hf-card__frozen">❄️ congelado</span>}
          {challenge && challenge.status !== "won" && (
            <span className={`hf-card__challenge-tag${challenge.status === "broken" ? " is-broken" : ""}`}>
              {challenge.status === "broken"
                ? "reto roto"
                : challenge.status === "upcoming"
                  ? `reto desde ${dayjs(challenge.startKey).format("D MMM")}`
                  : `reto ${challenge.dayIndex}/${challenge.days}`}
            </span>
          )}
          {note && (
            <span className="hf-card__note" title={note}>
              <FormOutlined /> nota
            </span>
          )}
        </span>
        {challenge && challenge.status === "active" && (
          <span className="hf-card__challenge" aria-hidden="true">
            <i style={{ width: `${challengePct}%` }} />
          </span>
        )}
      </span>
      <span className="hf-card__actions">
        {onEdit && (
          <button
            type="button"
            className="hf-card__edit"
            aria-label={`Editar ${habit.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(habit);
            }}
          >
            <EditOutlined />
          </button>
        )}
        {onFocus && canToggle && !completed && canFocus(habit) && (
          <button
            type="button"
            className="hf-card__edit hf-card__focus"
            aria-label={`Enfoque: temporizador para ${habit.title}`}
            title="Temporizador de enfoque"
            onClick={(e) => {
              e.stopPropagation();
              onFocus(habit);
            }}
          >
            <CaretRightOutlined />
          </button>
        )}
        {quit ? (
          <button
            type="button"
            className="hf-relapse"
            disabled={!canToggle || habit.relapsedToday || !onRelapse}
            title={canToggle ? undefined : "Solo hoy o en los últimos días"}
            onClick={(e) => {
              e.stopPropagation();
              onRelapse?.(habit);
            }}
          >
            {habit.relapsedToday ? "Anotada" : "Recaí"}
          </button>
        ) : measurable ? (
          <button
            type="button"
            className="hf-check hf-check--ring"
            aria-label={`Sumar ${habit.step} a ${habit.title} (${amountLabel(habit.valueToday, habit.goal, habit.unit)})`}
            disabled={!canToggle}
            title={canToggle ? undefined : "Solo puedes marcar habitos de hoy o de ayer"}
            onClick={handleToggle}
          >
            <svg className="hf-ring" width="44" height="44" viewBox="0 0 36 36" aria-hidden="true">
              <circle className="hf-ring__track" cx="18" cy="18" r="15.5" />
              <circle
                className="hf-ring__fill"
                cx="18"
                cy="18"
                r="15.5"
                strokeDasharray={`${(ringPct * RING).toFixed(2)} ${RING.toFixed(2)}`}
                transform="rotate(-90 18 18)"
              />
            </svg>
            {completed ? (
              <svg className="hf-ring__check" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            ) : (
              <span className="hf-ring__value">{habit.valueToday}</span>
            )}
          </button>
        ) : (
          <button
            type="button"
            className="hf-check"
            aria-label={completed ? `Desmarcar ${habit.title}` : `Marcar ${habit.title}`}
            aria-pressed={completed}
            disabled={!canToggle}
            title={canToggle ? undefined : "Solo puedes marcar habitos de hoy o de ayer"}
            onClick={handleToggle}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </button>
        )}
      </span>
    </div>
  );
}

/** Chip de racha en dias o en semanas (la llama toma el color de los dias equivalentes). */
export function StreakChipFor({ n, weeks }: { n: number; weeks?: boolean }) {
  if (!weeks) return <StreakChip days={n} />;
  return <StreakChip days={n} stageDays={streakStageDays(n, "weeks")} suffix="sem" />;
}
