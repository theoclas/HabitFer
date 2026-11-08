import { EditOutlined, FormOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { StreakChip } from "../../apps/habitfer/components/Flame";
import { burstSparks, buzz, playTick } from "../../apps/habitfer/effects";
import type { Habit, HabitToday } from "../../types";
import { habitEmoji, habitScheduleLabel } from "./habitUtils";

type Props = {
  habit: Habit | HabitToday;
  /** Se acepta por compatibilidad; el check ya es optimista y no se bloquea. */
  loading?: boolean;
  canToggle?: boolean;
  /** Muestra la racha "en riesgo" (de noche, si el habito sigue pendiente). */
  riskWindow?: boolean;
  layout?: "list" | "grid";
  onToggle: (habit: Habit | HabitToday) => void | Promise<void>;
  onOpen?: (habit: Habit | HabitToday) => void;
  onEdit?: (habit: Habit | HabitToday) => void;
  /** Mantener presionada la tarjeta (o clic derecho) abre la nota del dia. */
  onNote?: (habit: Habit | HabitToday) => void;
};

/** Nombre compartido con la cabecera del detalle para la transicion entre pantallas. */
export const HABIT_HERO_TRANSITION = "hf-habit-hero";

const LONG_PRESS_MS = 520;

export function HabitCard({ habit, loading, canToggle = true, riskWindow = false, onToggle, onOpen, onEdit, onNote }: Props) {
  const completed = habit.completedToday;
  const atRisk = riskWindow && !completed && habit.streakEnabled && habit.currentStreak >= 3;
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
    if (!completed) {
      burstSparks(e.currentTarget, habit.color);
      buzz();
      playTick();
    }
    void onToggle(habit);
  };

  const classes = ["hf-card", completed ? "is-done" : "", atRisk ? "is-risk" : "", justDone ? "just-done" : ""]
    .filter(Boolean)
    .join(" ");

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
      aria-label={`${habit.title}${completed ? ", hecho" : ""}`}
    >
      <span className="hf-card__emoji" aria-hidden="true">
        {habitEmoji(habit.icon)}
      </span>
      <span className="hf-card__body">
        <span className="hf-card__title">{habit.title}</span>
        <span className="hf-card__meta">
          {habit.streakEnabled && habit.currentStreak > 0 && <StreakChip days={habit.currentStreak} />}
          {atRisk && <span className="hf-card__risk">en riesgo</span>}
          <span>{habitScheduleLabel(habit)}</span>
          {note && (
            <span className="hf-card__note" title={note}>
              <FormOutlined /> nota
            </span>
          )}
        </span>
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
      </span>
    </div>
  );
}
