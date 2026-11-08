import { Input, Modal, message } from "antd";
import { useCallback, useRef, type MutableRefObject } from "react";
import { relapseHabit } from "../../api/client";
import { apiErrorMessage } from "../../apps/habitfer/format";
import { setValueRemote, toggleHabitRemote } from "../../apps/habitfer/offline";
import type { CompleteHabitResponse, Habit } from "../../types";
import { useAchievements } from "../achievements/AchievementContext";
import { applyOptimisticToggle, applyOptimisticValue, isMeasurable, streakLabel } from "./habitUtils";

type Options<T extends Habit> = {
  /** Lista actual (ref, para leer siempre lo ultimo sin esperar a React). */
  itemsRef: MutableRefObject<T[]>;
  setItems: (next: T[]) => void;
  /** Dia que se marca (YYYY-MM-DD). */
  dateKey: string;
  canMark: boolean;
  /** Algo paso a hecho (para revisar el dia perfecto). */
  onBecameDone?: () => void;
  /** Ya no queda nada en camino: buen momento para recargar en silencio. */
  onSettled?: () => void;
};

const OFFLINE_TEXT = "Sin conexión: lo guardé y lo envío cuando vuelva la señal";
const VALUE_DEBOUNCE_MS = 650;

/**
 * Acciones sobre un habito con cambio optimista y cola sin conexion:
 * marcar o desmarcar, sumar cantidad (medibles) y registrar una recaida (dejar algo).
 * En los medibles los toques seguidos se juntan y se manda solo el ultimo valor, en orden.
 */
export function useHabitActions<T extends Habit>(options: Options<T>) {
  const { celebrate } = useAchievements();
  const opts = useRef(options);
  opts.current = options;
  const pending = useRef(new Set<string>());
  const timers = useRef(new Map<string, number>());
  const sending = useRef(new Map<string, Promise<void>>());
  const desired = useRef(new Map<string, { value: number; date: string }>());
  const confirmed = useRef(new Map<string, T>());

  const replace = useCallback((id: string, mapper: (h: T) => T) => {
    const { itemsRef, setItems } = opts.current;
    const next = itemsRef.current.map((h) => (h.id === id ? mapper(h) : h));
    itemsRef.current = next;
    setItems(next);
  }, []);

  const celebrateResult = useCallback(
    (res?: CompleteHabitResponse) => {
      if (res?.unlockedAchievement) celebrate(res.unlockedAchievement);
      if (res?.challengeWon) celebrate(res.challengeWon);
    },
    [celebrate],
  );

  const idle = () => pending.current.size === 0 && timers.current.size === 0 && sending.current.size === 0;

  const toggle = useCallback(
    async (habit: T) => {
      const { canMark, dateKey, itemsRef } = opts.current;
      if (!canMark) {
        message.warning("Solo puedes marcar habitos de hoy o de ayer");
        return;
      }
      if (pending.current.has(habit.id)) return;
      const original = itemsRef.current.find((h) => h.id === habit.id);
      if (!original) return;
      const willComplete = !original.completedToday;
      pending.current.add(habit.id);
      replace(habit.id, (h) => applyOptimisticToggle(h, willComplete));
      try {
        const res = await toggleHabitRemote(habit.id, dateKey, willComplete);
        pending.current.delete(habit.id);
        if (res.queued) {
          message.open({ key: "hf-offline", type: "info", content: OFFLINE_TEXT });
        } else if ("completed" in res) {
          celebrateResult(res.completed);
        }
        if (willComplete) opts.current.onBecameDone?.();
        if (!res.queued && idle()) opts.current.onSettled?.();
      } catch {
        pending.current.delete(habit.id);
        replace(habit.id, () => original);
        message.error("No se pudo actualizar, lo deje como estaba");
      }
    },
    [replace, celebrateResult],
  );

  const flushValue = useCallback(
    async (id: string) => {
      timers.current.delete(id);
      const previous = sending.current.get(id);
      if (previous) await previous;
      const want = desired.current.get(id);
      if (!want) return;
      desired.current.delete(id);
      const run = (async () => {
        try {
          const res = await setValueRemote(id, want.date, want.value);
          if (res.queued) {
            message.open({ key: "hf-offline", type: "info", content: OFFLINE_TEXT });
            return;
          }
          celebrateResult(res.result);
          if (!desired.current.has(id)) confirmed.current.delete(id);
        } catch (err) {
          const back = confirmed.current.get(id);
          confirmed.current.delete(id);
          desired.current.delete(id);
          // Solo se revierte si todavia se esta mirando ese mismo dia.
          if (back && opts.current.dateKey === want.date) replace(id, () => back);
          message.error(apiErrorMessage(err, "No se pudo guardar la cantidad, la dejé como estaba"));
        }
      })();
      sending.current.set(id, run);
      await run;
      if (sending.current.get(id) === run) sending.current.delete(id);
      if (idle()) opts.current.onSettled?.();
    },
    [replace, celebrateResult],
  );

  /** Fija la cantidad del dia (medibles) al instante y la manda un momento despues. */
  const setValue = useCallback(
    (habit: T, value: number) => {
      const { canMark, dateKey, itemsRef } = opts.current;
      if (!canMark) {
        message.warning("Solo puedes marcar habitos de hoy o de ayer");
        return;
      }
      const current = itemsRef.current.find((h) => h.id === habit.id);
      if (!current) return;
      if (!confirmed.current.has(habit.id)) confirmed.current.set(habit.id, current);
      const next = Math.max(0, Math.round(value));
      const wasDone = current.completedToday;
      replace(habit.id, (h) => applyOptimisticValue(h, next));
      if (!wasDone && next >= Math.max(1, habit.goal)) opts.current.onBecameDone?.();
      desired.current.set(habit.id, { value: next, date: dateKey });
      window.clearTimeout(timers.current.get(habit.id));
      timers.current.set(habit.id, window.setTimeout(() => void flushValue(habit.id), VALUE_DEBOUNCE_MS));
    },
    [replace, flushValue],
  );

  const addStep = useCallback(
    (habit: T) => {
      const current = opts.current.itemsRef.current.find((h) => h.id === habit.id) ?? habit;
      setValue(habit, (current.valueToday ?? 0) + Math.max(1, habit.step));
    },
    [setValue],
  );

  /** Toque principal: suma en los medibles, marca o desmarca en el resto. */
  const press = useCallback(
    (habit: T) => {
      if (isMeasurable(habit)) addStep(habit);
      else void toggle(habit);
    },
    [addStep, toggle],
  );

  const relapse = useCallback((habit: T) => {
    let note = "";
    Modal.confirm({
      title: `¿Registrar una recaída en «${habit.title}»?`,
      icon: null,
      content: (
        <div style={{ display: "grid", gap: 10 }}>
          <p style={{ margin: 0 }}>
            Tu cuenta de días limpio vuelve a empezar.
            {habit.longestStreak > 0 ? ` Tu mejor marca (${streakLabel(habit.longestStreak)}) se queda.` : ""}
          </p>
          <Input.TextArea
            maxLength={300}
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder="¿Qué pasó? Te sirve para la próxima (opcional)"
            onChange={(e) => {
              note = e.target.value;
            }}
          />
        </div>
      ),
      okText: "Registrar recaída",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await relapseHabit(habit.id, { date: opts.current.dateKey, note: note.trim() || undefined });
          message.info("Registrado. Una recaída no borra lo que ya lograste: sigue.");
          opts.current.onSettled?.();
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo registrar la recaída"));
        }
      },
    });
  }, []);

  return { toggle, setValue, addStep, press, relapse };
}

/** Celebra una sola vez lo que llega al cargar (hitos de dias limpio, retos cumplidos). */
export function useCelebrateLoaded() {
  const { celebrate } = useAchievements();
  const seen = useRef(new Set<string>());
  return useCallback(
    (items: Habit[]) => {
      for (const h of items) {
        for (const a of [h.unlockedAchievement, h.challengeWon]) {
          if (a && !seen.current.has(a.id)) {
            seen.current.add(a.id);
            celebrate(a);
          }
        }
      }
    },
    [celebrate],
  );
}
