import { CloseOutlined, MinusOutlined, PauseOutlined, PlusOutlined, CaretRightOutlined } from "@ant-design/icons";
import { Button, Modal, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { fetchHabit } from "../../../api/client";
import { useAchievements } from "../../../features/achievements/AchievementContext";
import { habitEmoji, unitFor } from "../../../features/habits/habitUtils";
import { buzz, notifyHabitsChanged, playTick } from "../effects";
import { mmss, saveFocusSession, suggestedMinutes, type FocusHabit, type FocusSession } from "../focus";
import { apiErrorMessage } from "../format";
import { setValueRemote } from "../offline";
import { Flame, FLAME_STAGES } from "./Flame";

type Props = {
  habit: FocusHabit;
  /** Sesion guardada para retomar (si se recargo la app con el temporizador andando). */
  resume?: FocusSession | null;
  onClose: () => void;
};

const PRESETS = [5, 10, 15, 25, 30, 45, 60];
const R = 120;
const CIRC = 2 * Math.PI * R;

type WakeLockLike = { release: () => Promise<void> };

/** Pantalla completa de enfoque: cuenta regresiva y, al terminar, suma los minutos al habito. */
export function FocusTimer({ habit, resume, onClose }: Props) {
  const { celebrate } = useAchievements();
  const [minutes, setMinutes] = useState(() => (resume ? Math.round(resume.durationMs / 60000) : suggestedMinutes(habit)));
  const [session, setSession] = useState<FocusSession | null>(resume ?? null);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const wakeRef = useRef<WakeLockLike | null>(null);
  const finishingRef = useRef(false);
  const askingRef = useRef(false);
  // Con el hook (y no Modal.confirm) la confirmación toma el tema de la app.
  const [modal, contextHolder] = Modal.useModal();

  const running = Boolean(session?.endAt);
  const remainingMs = session ? (session.endAt ? session.endAt - now : session.remainingMs) : minutes * 60000;
  const durationMs = session?.durationMs ?? minutes * 60000;
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / durationMs));
  const stage = FLAME_STAGES[Math.min(FLAME_STAGES.length - 1, Math.floor(progress * FLAME_STAGES.length))];

  const persist = (s: FocusSession | null) => {
    setSession(s);
    saveFocusSession(s);
  };

  // Sin scroll detras de la pantalla completa.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  // Pantalla encendida mientras corre.
  useEffect(() => {
    if (!running) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> } };
    const acquire = () => {
      nav.wakeLock
        ?.request("screen")
        .then((lock) => {
          wakeRef.current = lock;
        })
        .catch(() => undefined);
    };
    acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void wakeRef.current?.release().catch(() => undefined);
      wakeRef.current = null;
    };
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  /** Suma `mins` minutos al habito (sobre lo que tenga ahora en el servidor). */
  const addMinutes = useCallback(
    async (mins: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setSaving(true);
      try {
        const date = session?.date ?? dayjs().format("YYYY-MM-DD");
        const fresh = await fetchHabit(habit.id).catch(() => null);
        const base = fresh && date === dayjs().format("YYYY-MM-DD") ? fresh.valueToday : habit.valueToday;
        const value = base + mins;
        const res = await setValueRemote(habit.id, date, value);
        if (res.queued) {
          message.info("Sin conexión: guardé los minutos y los envío cuando vuelva la señal");
        } else {
          if (res.result.unlockedAchievement) celebrate(res.result.unlockedAchievement);
          if (res.result.challengeWon) celebrate(res.result.challengeWon);
          message.success(`Sumaste ${mins} ${unitFor(mins, habit.unit) || "minutos"} a ${habit.title}: ${value} de ${habit.goal}`);
        }
        notifyHabitsChanged();
      } catch (err) {
        message.error(apiErrorMessage(err, "No se pudieron sumar los minutos"));
      } finally {
        setSaving(false);
        persist(null);
        onClose();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habit, session, celebrate, onClose],
  );

  // Llego a cero: aviso y suma.
  useEffect(() => {
    if (!running || remainingMs > 0 || finishingRef.current) return;
    buzz([90, 60, 90]);
    playTick("perfect");
    const mins = Math.round(durationMs / 60000);
    if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
      void navigator.serviceWorker?.ready
        .then((reg) => reg.showNotification("⏱️ Enfoque terminado", { body: `${mins} minutos de ${habit.title}`, tag: "hf-focus", icon: "/icons/icon-192.png" }))
        .catch(() => undefined);
    }
    void addMinutes(mins);
  }, [running, remainingMs, durationMs, habit.title, addMinutes]);

  const start = () => {
    const ms = minutes * 60000;
    persist({ habit, date: dayjs().format("YYYY-MM-DD"), durationMs: ms, endAt: Date.now() + ms, remainingMs: ms });
    setNow(Date.now());
    buzz(15);
  };
  const pause = () => session && persist({ ...session, endAt: null, remainingMs: Math.max(0, (session.endAt ?? now) - Date.now()) });
  const resumeRun = () => {
    if (!session) return;
    persist({ ...session, endAt: Date.now() + session.remainingMs });
    setNow(Date.now());
  };

  /** Terminar antes de tiempo: el reloj se detiene mientras se decide qué hacer con lo hecho. */
  const stop = () => {
    if (askingRef.current || finishingRef.current) return;
    if (!session) {
      onClose();
      return;
    }
    const left = session.endAt ? Math.max(0, session.endAt - Date.now()) : session.remainingMs;
    const elapsedMin = Math.floor((session.durationMs - left) / 60000);
    if (elapsedMin < 1) {
      persist(null);
      onClose();
      return;
    }
    const wasRunning = Boolean(session.endAt);
    const paused: FocusSession = { ...session, endAt: null, remainingMs: left };
    persist(paused);
    askingRef.current = true;
    const instance = modal.confirm({
      title: `¿Sumar ${elapsedMin} ${elapsedMin === 1 ? "minuto" : "minutos"} a ${habit.title}?`,
      content: "Paraste antes de tiempo. Puedes sumar lo que alcanzaste, descartarlo o seguir.",
      okText: "Sumarlos",
      cancelText: "Descartar",
      keyboard: false,
      maskClosable: false,
      footer: (_, { OkBtn, CancelBtn }) => (
        <>
          <Button
            onClick={() => {
              instance.destroy();
              askingRef.current = false;
              if (wasRunning) {
                persist({ ...paused, endAt: Date.now() + paused.remainingMs });
                setNow(Date.now());
              }
            }}
          >
            Seguir
          </Button>
          <CancelBtn />
          <OkBtn />
        </>
      ),
      onOk: () => addMinutes(elapsedMin),
      onCancel: () => {
        persist(null);
        onClose();
      },
      afterClose: () => {
        askingRef.current = false;
      },
    });
  };

  // Teclado: espacio pausa o sigue; Esc termina (pregunta si ya pasó un minuto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (askingRef.current) return;
      if (e.key === "Escape") stop();
      if (e.key === " " && session) {
        e.preventDefault();
        if (running) pause();
        else resumeRun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const left = Math.max(0, habit.goal - habit.valueToday);

  return createPortal(
    <div className="hf-focus" role="dialog" aria-modal="true" aria-label={`Enfoque: ${habit.title}`} style={{ "--c": habit.color } as CSSProperties}>
      <button type="button" className="hf-focus__close" aria-label="Salir del enfoque" onClick={stop}>
        <CloseOutlined />
      </button>
      <div className="hf-focus__habit">
        <span aria-hidden="true">{habitEmoji(habit.icon)}</span>
        <b>{habit.title}</b>
        <small>
          {habit.valueToday} de {habit.goal} {unitFor(habit.goal, habit.unit)} hoy{left > 0 ? ` · te faltan ${left}` : " · meta cumplida"}
        </small>
      </div>

      <div className="hf-focus__dial">
        <svg viewBox="0 0 280 280" width="280" height="280" aria-hidden="true">
          <circle cx="140" cy="140" r={R} className="hf-focus__track" />
          <circle
            cx="140"
            cy="140"
            r={R}
            className="hf-focus__fill"
            strokeDasharray={`${(progress * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`}
            transform="rotate(-90 140 140)"
          />
        </svg>
        <div className="hf-focus__center">
          <Flame stage={stage} size={48 + Math.round(progress * 28)} glow />
          <span className="hf-focus__time" aria-live="off">
            {mmss(remainingMs)}
          </span>
          <span className="hf-focus__state">{saving ? "Guardando…" : !session ? "listo" : running ? "en marcha" : "en pausa"}</span>
        </div>
      </div>

      {!session ? (
        <>
          <div className="hf-focus__adjust">
            <button type="button" aria-label="Un minuto menos" onClick={() => setMinutes((m) => Math.max(1, m - 1))}>
              <MinusOutlined />
            </button>
            <span>
              <b>{minutes}</b> min
            </span>
            <button type="button" aria-label="Un minuto más" onClick={() => setMinutes((m) => Math.min(120, m + 1))}>
              <PlusOutlined />
            </button>
          </div>
          <div className="hf-focus__presets">
            {PRESETS.map((p) => (
              <button key={p} type="button" className={p === minutes ? "is-on" : ""} onClick={() => setMinutes(p)}>
                {p}
              </button>
            ))}
          </div>
          <button type="button" className="hf-focus__go" onClick={start}>
            <CaretRightOutlined /> Empezar
          </button>
        </>
      ) : (
        <div className="hf-focus__controls">
          <button type="button" className="hf-focus__go" onClick={running ? pause : resumeRun} disabled={saving}>
            {running ? (
              <>
                <PauseOutlined /> Pausa
              </>
            ) : (
              <>
                <CaretRightOutlined /> Seguir
              </>
            )}
          </button>
          <button type="button" className="hf-focus__stop" onClick={stop} disabled={saving}>
            Terminar ya
          </button>
        </div>
      )}
      <p className="hf-focus__hint">La pantalla se queda encendida. Si sales de la app, el tiempo sigue corriendo.</p>
      {contextHolder}
    </div>,
    document.body,
  );
}
