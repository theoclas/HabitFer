import {
  CaretRightOutlined,
  CheckOutlined,
  CloseOutlined,
  MutedOutlined,
  PauseOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SoundOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from "@ant-design/icons";
import { Button, InputNumber, Modal, message } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchHistory, fetchRoutine, saveWorkout, updateWorkout } from "../api";
import { CountdownRing } from "../components/CountdownRing";
import { ExerciseFigure } from "../components/ExerciseFigure";
import { ExerciseSheet } from "../components/ExerciseSheet";
import { PlayerFinish, type FinishState } from "../components/PlayerFinish";
import { PlayerSetup } from "../components/PlayerSetup";
import { Stepper } from "../components/Stepper";
import { clock, fullDate, lastText, shiftDay, todayKey } from "../format";
import { findReady, useLibrary, waitsForPrograms } from "../hooks";
import { FF_BASE } from "../layouts/FerFitShell";
import { Coach } from "../player/coach";
import * as E from "../player/engine";
import {
  buildPlan,
  defaultLog,
  mostlyGentle,
  planSeconds,
  planSignature,
  stepSeconds,
  summarize,
  type PlanItem,
  type PlanMode,
  type PlanOptions,
  type PlanRoutine,
  type Step,
  type StepLog,
} from "../player/plan";
import { clearSession, readPrefs, readSession, writePrefs, writeSession, type PlayerPrefs, type SavedSession } from "../player/storage";
import { useWakeLock } from "../player/useWakeLock";
import type { History, Routine } from "../types";

type Source = { name: string; routine: PlanRoutine };
/** Lo que se ajusta en el paso de ahora: repeticiones hechas y peso. */
type Draft = { index: number; reps: number | null; weight: number | null };
const NO_DRAFT: Draft = { index: -1, reps: null, weight: null };

const toPlanItem = (i: { key: string; sets: number; reps?: number | null; seconds?: number | null; rest: number }): PlanItem => ({
  key: i.key,
  sets: i.sets,
  reps: i.reps ?? null,
  seconds: i.seconds ?? null,
  rest: i.rest,
});

function phaseText(steps: Step[], i: number): string {
  const s = steps[i];
  if (!s) return "";
  if (s.kind === "prep") return "Prepárate";
  if (s.kind === "rest") {
    const prev = steps[i - 1];
    if (prev && prev.block !== s.block) return s.block === "main" ? "Ahora, la rutina" : "Ahora, a estirar";
    return "Descanso";
  }
  if (s.block === "warmup") return "Calentamiento";
  if (s.block === "cooldown") return "Estirar";
  if (s.emom) return "Cada minuto";
  return "¡Vamos!";
}

/** «Ejercicio 3 de 8», o «Calentamiento 2 de 6» y «Estirar 1 de 6». */
const whereText = (s: Step | undefined) => (!s ? "" : s.block === "main" ? `Ejercicio ${s.pos} de ${s.count}` : s.label);

/** Lo que pide un paso de trabajo: «12 repeticiones», «30 s por lado», «45 s». */
function goalText(s: Step): string {
  if (s.emom) return s.goalSeconds != null ? `${s.goalSeconds} s y descansa el resto del minuto` : `${s.reps ?? 10} ${s.perSide ? "por lado" : "repeticiones"} y descansa el resto`;
  if (!s.timed) return `${s.reps ?? 10} ${s.perSide ? "repeticiones por lado" : "repeticiones"}`;
  return s.perSide ? `${Math.round(s.seconds / 2)} s por lado` : `${s.seconds} s`;
}

/** La línea bajo el nombre. Lo que sigue: la serie y lo que pide. Ahora: la serie, y el tiempo solo si es por lado o
 * cada minuto (las repeticiones y los segundos ya salen en grande). */
function stepLine(s: Step | undefined, current: boolean): string {
  if (!s) return "";
  const extra = !current || s.emom || (s.timed && s.perSide) ? goalText(s) : "";
  return [s.block === "main" ? s.label : "", extra].filter(Boolean).join(" · ");
}

/** El entreno guiado: antes de empezar, el entrenamiento paso a paso y el resumen al terminar. */
export function FitPlayerPage() {
  const { id, key } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { lib, error: libError, byKey } = useLibrary();
  const ref = id ? `r:${id}` : `l:${key ?? ""}`;
  const backUrl = id ? `${FF_BASE}/rutinas/${id}` : `${FF_BASE}/listas/${key ?? ""}`;
  const today = todayKey();
  const [date, setDate] = useState(() => {
    const w = params.get("fecha");
    return w && /^\d{4}-\d{2}-\d{2}$/.test(w) && w <= today ? w : today;
  });

  /* ---------- La rutina y la última vez ---------- */
  const [own, setOwn] = useState<Routine | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!id) return;
    fetchRoutine(id)
      .then(setOwn)
      .catch(() => setMissing(true));
  }, [id]);
  const ready = findReady(lib, key);
  const source = useMemo<Source | null>(() => {
    if (own) {
      const items = own.items.map((i) => toPlanItem({ key: i.exerciseKey, sets: i.sets, reps: i.reps, seconds: i.seconds, rest: i.restSeconds }));
      return { name: own.name, routine: { circuit: own.circuit, rounds: own.rounds, items } };
    }
    if (ready) return { name: ready.name, routine: { circuit: ready.circuit, rounds: ready.rounds, items: ready.items.map(toPlanItem) } };
    return null;
  }, [own, ready]);

  const [history, setHistory] = useState<History>({});
  const historyRef = useRef(history);
  historyRef.current = history;
  const itemKeys = source ? source.routine.items.map((i) => i.key).join(",") : "";
  useEffect(() => {
    if (!itemKeys) return;
    fetchHistory(itemKeys.split(","))
      .then(setHistory)
      .catch(() => undefined);
  }, [itemKeys]);

  /* ---------- Preferencias y opciones ---------- */
  const [prefs, setPrefs] = useState<PlayerPrefs>(readPrefs);
  const updatePrefs = useCallback((p: Partial<PlayerPrefs>) => {
    setPrefs((cur) => {
      const next = { ...cur, ...p };
      writePrefs(next);
      return next;
    });
  }, []);
  const gentle = useMemo(() => !!source && mostlyGentle(source.routine.items.map((i) => byKey.get(i.key)?.focus ?? "")), [source, byKey]);
  const [mode, setMode] = useState<PlanMode>("normal");
  const [warmupSel, setWarmupSel] = useState<boolean | null>(null);
  const [cooldownSel, setCooldownSel] = useState<boolean | null>(null);
  const options = useMemo<PlanOptions>(
    () => ({
      warmup: warmupSel ?? (gentle ? false : (prefs.warmup ?? true)),
      cooldown: cooldownSel ?? (gentle ? false : (prefs.cooldown ?? true)),
      mode,
      work: prefs.work,
      rest: prefs.rest,
      rounds: prefs.rounds,
    }),
    [warmupSel, cooldownSel, gentle, prefs.warmup, prefs.cooldown, mode, prefs.work, prefs.rest, prefs.rounds],
  );
  const info = useCallback((k: string) => byKey.get(k), [byKey]);
  // La biblioteca guardada en el teléfono puede ser de antes del calentamiento: entonces no hay bloques.
  const blocks = useMemo(
    () => (lib?.blocks ? { warmup: lib.blocks.warmup.items.map(toPlanItem), cooldown: lib.blocks.cooldown.items.map(toPlanItem) } : undefined),
    [lib],
  );
  const preview = useMemo(() => (source && lib ? buildPlan(source.routine, options, info, blocks) : []), [source, lib, options, info, blocks]);

  const [saved, setSaved] = useState<SavedSession | null>(() => readSession(ref));
  const resumable = useMemo(() => {
    if (!saved || !source || !lib) return null;
    const list = buildPlan(source.routine, saved.options, info, blocks);
    if (planSignature(list) !== saved.sig || saved.state.index >= list.length) return null;
    return { steps: list, session: saved };
  }, [saved, source, lib, info, blocks]);

  /* ---------- El entrenamiento ---------- */
  const [phase, setPhase] = useState<"setup" | "play" | "finish">("setup");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [steps, setSteps] = useState<Step[]>([]);
  const stepsRef = useRef<Step[]>([]);
  const sigRef = useRef("");
  const optionsRef = useRef<PlanOptions>(options);
  const dateRef = useRef(date);
  const [engine, setEngine] = useState<E.EngineState>(E.idle);
  const engineRef = useRef<E.EngineState>(engine);
  const logsRef = useRef<Record<number, StepLog>>({});
  const [draft, setDraft] = useState<Draft>(NO_DRAFT);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const cueRef = useRef({ index: -1, sec: -1, half: false });
  const [now, setNow] = useState(() => Date.now());
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [finish, setFinish] = useState<FinishState | null>(null);
  const retryRef = useRef<() => void>(() => undefined);
  const [effort, setEffort] = useState<number | null>(null);
  const [effortSaved, setEffortSaved] = useState(false);

  const coach = useMemo(() => new Coach(), []);
  useEffect(() => () => coach.close(), [coach]);
  useEffect(() => {
    coach.voice = prefs.voice;
    coach.sounds = prefs.sounds;
    if (!prefs.voice) coach.hush();
  }, [coach, prefs.voice, prefs.sounds]);
  const wake = useWakeLock(phase === "play");
  const wakeRequest = wake.request;

  const totals = useMemo(() => {
    const prefix = [0];
    for (const st of steps) prefix.push(prefix[prefix.length - 1] + stepSeconds(st));
    return { prefix, total: prefix[prefix.length - 1] };
  }, [steps]);

  const setState = useCallback((s: E.EngineState) => {
    engineRef.current = s;
    setEngine(s);
  }, []);

  /** Lo que se propone para un paso: las repeticiones planeadas y el último peso de este ejercicio. */
  const draftFor = useCallback((i: number): Draft => {
    const s = stepsRef.current[i];
    if (!s || s.kind !== "work") return { index: i, reps: null, weight: null };
    let weight: number | null = null;
    for (let j = i - 1; j >= 0 && weight === null; j--) {
      if (stepsRef.current[j]?.key === s.key && logsRef.current[j]?.weight != null) weight = logsRef.current[j].weight;
    }
    if (weight === null) weight = [...(historyRef.current[s.key]?.sets ?? [])].reverse().find((x) => x.weight != null)?.weight ?? null;
    return { index: i, reps: s.reps, weight };
  }, []);

  const persist = useCallback(() => {
    const s = engineRef.current;
    if (phaseRef.current !== "play" || !stepsRef.current.length || s.status === "ready" || s.status === "finished") return;
    const t = Date.now();
    writeSession({ v: 1, ref, date: dateRef.current, options: optionsRef.current, sig: sigRef.current, state: E.frozen(s, t), logs: logsRef.current, savedAt: t });
  }, [ref]);

  const announce = useCallback(
    (i: number) => {
      const s = stepsRef.current[i];
      if (!s) return;
      cueRef.current = { index: i, sec: -1, half: false };
      coach.say(s.say);
      if (s.kind === "work") coach.beep("go");
      setDraft(draftFor(i));
    },
    [coach, draftFor],
  );

  const saveResult = useCallback(
    async (s: E.EngineState, partial: boolean) => {
      const sum = summarize(stepsRef.current, s.done, logsRef.current);
      const activeMs = E.activeTime(s, Date.now());
      const base = { partial, activeMs, exercises: sum.exercises, sets: sum.sets };
      if (!sum.addDone.length) {
        setFinish({ ...base, status: "empty" });
        return;
      }
      const run = async () => {
        setFinish({ ...base, status: "saving" });
        try {
          const w = await saveWorkout({
            date: dateRef.current,
            kind: "ROUTINE",
            ...(id ? { routineId: id } : { readyKey: key }),
            addDone: sum.addDone,
            logs: sum.logs,
            minutes: Math.max(1, Math.round(activeMs / 60000)),
          });
          setFinish({ ...base, status: "saved", workoutId: w.id });
        } catch (err) {
          setFinish({ ...base, status: "error" });
          message.error(apiErrorMessage(err, "No se pudo guardar"));
        }
      };
      retryRef.current = () => void run();
      await run();
    },
    [id, key],
  );

  const finishNow = useCallback(
    (s: E.EngineState, partial: boolean) => {
      clearSession();
      setSaved(null);
      setState(s);
      if (partial) coach.hush();
      else coach.say("¡Terminaste! Buen trabajo.");
      setPhase("finish");
      phaseRef.current = "finish";
      void saveResult(s, partial);
    },
    [coach, saveResult, setState],
  );

  const apply = useCallback(
    (change: E.Change) => {
      const st = stepsRef.current;
      for (const i of change.undone) delete logsRef.current[i];
      let ended = false;
      for (const i of change.completed) {
        if (logsRef.current[i]) continue;
        // Terminó solo (un paso con tiempo): lo planeado, con lo que se haya ajustado en el paso.
        const base = defaultLog(st[i]);
        const d = draftRef.current;
        logsRef.current[i] = d.index === i ? { ...base, reps: base.reps !== null ? (d.reps ?? base.reps) : null, weight: d.weight } : base;
        ended = true;
      }
      if (change.state.status === "finished") {
        finishNow(change.state, false);
        return;
      }
      setState(change.state);
      const last = change.started[change.started.length - 1];
      if (last !== undefined) {
        if (ended) coach.beep("end");
        announce(last);
      }
      persist();
    },
    [announce, coach, finishNow, persist, setState],
  );

  /** Pitidos de 3, 2, 1 al final de cada paso con tiempo y «cambia de lado» a la mitad de los que son por lado. */
  const countdownCues = useCallback(
    (t: number) => {
      const s = engineRef.current;
      const step = stepsRef.current[s.index];
      if (s.status !== "running" || !step?.timed) return;
      if (cueRef.current.index !== s.index) cueRef.current = { index: s.index, sec: -1, half: false };
      const left = E.leftMs(s, t);
      const sec = Math.ceil(left / 1000);
      if (s.durMs >= 5000 && sec >= 1 && sec <= 3 && sec !== cueRef.current.sec) {
        cueRef.current.sec = sec;
        coach.beep("tick");
      }
      if (step.kind === "work" && step.perSide && !step.emom && !cueRef.current.half && left <= s.durMs / 2 && left > 1500) {
        cueRef.current.half = true;
        coach.say("Cambia de lado.");
        coach.beep("tick");
      }
    },
    [coach],
  );

  useEffect(() => {
    if (phase !== "play") return undefined;
    const tickNow = () => {
      const t = Date.now();
      setNow(t);
      const s = engineRef.current;
      if (s.status !== "running") return;
      const change = E.tick(s, stepsRef.current, t);
      if (change.state !== s) apply(change);
      if (phaseRef.current === "play") countdownCues(t);
    };
    const timer = window.setInterval(tickNow, 200);
    const onVisible = () => {
      if (document.visibilityState === "hidden") persist();
      else tickNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", persist);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", persist);
    };
  }, [phase, apply, countdownCues, persist]);

  // Si se sale de la página a mitad (botón atrás), queda guardado para seguir después.
  useEffect(
    () => () => {
      if (phaseRef.current === "play") persist();
    },
    [persist],
  );

  const begin = useCallback(
    (list: Step[], from: SavedSession | null) => {
      if (!list.length) return;
      coach.unlock();
      void wakeRequest(true);
      stepsRef.current = list;
      sigRef.current = planSignature(list);
      setSteps(list);
      logsRef.current = from ? { ...from.logs } : {};
      optionsRef.current = from ? from.options : options;
      dateRef.current = from ? from.date : date;
      if (from) setDate(from.date);
      setPhase("play");
      phaseRef.current = "play";
      const t = Date.now();
      setNow(t);
      if (from) {
        const resumed = E.resume({ ...from.state, status: "paused" }, t);
        setState(resumed);
        announce(resumed.index);
        persist();
      } else {
        apply(E.start(list, t));
      }
    },
    [announce, apply, coach, date, options, persist, setState, wakeRequest],
  );

  /* ---------- Controles ---------- */
  const act = useCallback(
    (fn: (s: E.EngineState, st: Step[], t: number) => E.Change) => {
      coach.unlock();
      void wakeRequest(true);
      apply(fn(engineRef.current, stepsRef.current, Date.now()));
    },
    [apply, coach, wakeRequest],
  );

  const togglePause = useCallback(() => {
    const t = Date.now();
    const s = engineRef.current;
    coach.unlock();
    void wakeRequest(true);
    if (s.status === "running") {
      setState(E.pause(s, t));
      coach.hush();
    } else if (s.status === "paused") {
      setState(E.resume(s, t));
    }
    persist();
  }, [coach, persist, setState, wakeRequest]);

  /** «Listo» en los de repeticiones y «terminé antes» en los de tiempo: se anota lo hecho y sigue. */
  const markDone = useCallback(() => {
    const s = engineRef.current;
    const step = stepsRef.current[s.index];
    if (!step || step.kind !== "work" || (s.status !== "running" && s.status !== "paused")) return;
    const t = Date.now();
    const d = draftRef.current;
    const mine = d.index === s.index;
    if (step.timed && !step.emom) {
      const secs = Math.max(1, Math.round(E.stepElapsed(s, t) / 1000));
      logsRef.current[s.index] = { reps: null, seconds: step.perSide ? Math.max(1, Math.round(secs / 2)) : secs, weight: mine ? d.weight : null };
    } else {
      const base = defaultLog(step);
      logsRef.current[s.index] = { ...base, reps: mine ? (d.reps ?? base.reps) : base.reps, weight: mine ? d.weight : null };
    }
    act((cur, st, at) => E.complete(cur.status === "paused" ? E.resume(cur, at) : cur, st, at));
  }, [act]);

  const skipStep = useCallback(() => act(E.skip), [act]);
  const backStep = useCallback(() => act(E.back), [act]);
  const addTen = useCallback(() => {
    setState(E.addTime(engineRef.current, stepsRef.current, 10_000));
    persist();
  }, [persist, setState]);

  const pauseQuietly = useCallback(() => {
    const s = engineRef.current;
    if (s.status === "running") {
      setState(E.pause(s, Date.now()));
      coach.hush();
    }
    persist();
  }, [coach, persist, setState]);

  const openHelp = () => {
    pauseQuietly();
    setSheetKey(stepsRef.current[engineRef.current.index]?.key ?? null);
  };
  const openExit = () => {
    pauseQuietly();
    setExitOpen(true);
  };
  const leave = () => {
    persist();
    setExitOpen(false);
    navigate(backUrl);
  };
  const saveAndEnd = () => {
    setExitOpen(false);
    finishNow(E.frozen(engineRef.current, Date.now()), true);
  };

  useEffect(() => {
    if (phase !== "play") return undefined;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "BUTTON" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || sheetKey || exitOpen) return;
      if (e.key === " ") {
        e.preventDefault();
        togglePause();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        skipStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        backStep();
      } else if (e.key === "Enter") {
        const st = stepsRef.current[engineRef.current.index];
        if (st?.kind === "work" && !st.timed) {
          e.preventDefault();
          markDone();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, togglePause, skipStep, backStep, markDone, sheetKey, exitOpen]);

  const chooseEffort = async (n: number) => {
    setEffort(n);
    setEffortSaved(false);
    if (finish?.status !== "saved" || !finish.workoutId) return;
    try {
      await updateWorkout(finish.workoutId, { effort: n });
      setEffortSaved(true);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar el esfuerzo"));
    }
  };

  /* ---------- Pantallas ---------- */
  if (missing || (key && lib && !ready && !waitsForPrograms(lib, key))) {
    return (
      <div className="fit-player fit-player--setup">
        <div className="fit-empty">
          Esa rutina ya no existe.
          <Button onClick={() => navigate(`${FF_BASE}/rutinas`)}>Ver las rutinas</Button>
        </div>
      </div>
    );
  }
  if (!lib || !source) {
    return (
      <div className="fit-player fit-player--setup">
        <div className="fit-empty">{libError ? "No se pudo cargar. Revisa la conexión." : "Cargando…"}</div>
      </div>
    );
  }

  if (phase === "setup") {
    const at = resumable?.session.state.index ?? 0;
    const resume = resumable
      ? {
          where: whereText(resumable.steps[at]),
          done: summarize(resumable.steps, resumable.session.state.done, resumable.session.logs).exercises,
        }
      : null;
    const dateText = date === today ? null : date === shiftDay(today, -1) ? "se anota ayer" : `se anota el ${fullDate(date)}`;
    return (
      <PlayerSetup
        name={source.name}
        minutes={Math.max(1, Math.round(planSeconds(preview) / 60))}
        exercises={source.routine.items.filter((i) => byKey.has(i.key)).length}
        circuit={source.routine.circuit}
        dateText={dateText}
        mode={mode}
        onMode={setMode}
        work={prefs.work}
        rest={prefs.rest}
        rounds={prefs.rounds}
        onIntervals={updatePrefs}
        hasBlocks={!!blocks}
        warmup={options.warmup}
        cooldown={options.cooldown}
        warmupMinutes={lib.blocks?.warmup.minutes ?? 5}
        cooldownMinutes={lib.blocks?.cooldown.minutes ?? 5}
        onWarmup={(v) => {
          setWarmupSel(v);
          if (!gentle) updatePrefs({ warmup: v });
        }}
        onCooldown={(v) => {
          setCooldownSel(v);
          if (!gentle) updatePrefs({ cooldown: v });
        }}
        voice={prefs.voice}
        sounds={prefs.sounds}
        canSpeak={coach.canSpeak}
        onVoice={(v) => updatePrefs({ voice: v })}
        onSounds={(v) => updatePrefs({ sounds: v })}
        onTest={() => {
          coach.unlock();
          coach.voice = prefs.voice;
          coach.sounds = prefs.sounds;
          coach.beep("go");
          coach.say("Así suena tu entrenador. ¡Vamos!");
        }}
        wake={wake.state}
        resume={resume}
        onResume={() => resumable && begin(resumable.steps, resumable.session)}
        onDiscard={() => {
          clearSession();
          setSaved(null);
        }}
        canStart={preview.length > 0}
        onStart={() => {
          clearSession();
          setSaved(null);
          begin(preview, null);
        }}
        onClose={() => navigate(backUrl)}
      />
    );
  }

  if (phase === "finish") {
    return (
      <PlayerFinish
        state={finish}
        effort={effort}
        effortSaved={effortSaved}
        onEffort={(n) => void chooseEffort(n)}
        onRetry={() => retryRef.current()}
        onHome={() => navigate(FF_BASE)}
        onRoutine={() => navigate(backUrl)}
      />
    );
  }

  const s = engine;
  const step = steps[s.index];
  const upcoming = step && step.kind !== "work" ? steps[s.index + 1] : undefined;
  const shown = step?.kind === "work" ? step : upcoming;
  const ex = shown ? byKey.get(shown.key) : undefined;
  let nextWork: Step | undefined;
  for (let j = s.index + 1; j < steps.length; j++) {
    if (steps[j].kind === "work") {
      nextWork = steps[j];
      break;
    }
  }
  const left = E.leftMs(s, now);
  const elapsed = E.stepElapsed(s, now);
  const partSec = step ? (step.timed ? Math.max(0, (s.durMs - left) / 1000) : Math.min(elapsed / 1000, stepSeconds(step))) : 0;
  const progress = totals.total ? Math.min(1, ((totals.prefix[s.index] ?? 0) + partSec) / totals.total) : 0;
  const paused = s.status === "paused";
  const isWork = step?.kind === "work";
  const repsStep = isWork && !step.timed;
  const usesWeight = isWork && !!ex?.equipment.includes("mancuernas");
  const d = draft.index === s.index ? draft : { index: s.index, reps: step?.reps ?? null, weight: null };
  const last = isWork ? history[step.key] : undefined;
  const line = isWork ? stepLine(step, true) : stepLine(upcoming, false);
  const doneSoFar = summarize(steps, s.done, logsRef.current).exercises;
  const ringSub = !step
    ? null
    : isWork && step.perSide && !step.emom
      ? `Lado ${left > s.durMs / 2 ? 1 : 2}`
      : step.emom
        ? step.goalSeconds != null
          ? `${step.goalSeconds} s`
          : `${d.reps ?? step.reps} rep.`
        : null;
  const nextText = nextWork ? (nextWork.key === step?.key ? `${nextWork.label.toLowerCase() || "otra serie"}` : (byKey.get(nextWork.key)?.name ?? "")) : "";
  const adjust = (
    <div className="fit-reps__adjust">
      {d.reps != null && (
        <Stepper label="Repeticiones hechas" value={d.reps} min={0} max={200} unit="rep." onChange={(v) => setDraft({ ...d, reps: v })} />
      )}
      {usesWeight && (
        <InputNumber
          className="fit-weight"
          aria-label="Peso en kilos"
          placeholder="Peso"
          min={0}
          max={200}
          step={1}
          decimalSeparator=","
          value={d.weight}
          suffix="kg"
          inputMode="decimal"
          onChange={(v) => setDraft({ ...d, weight: typeof v === "number" ? v : null })}
        />
      )}
    </div>
  );

  return (
    <div className="fit-player" data-kind={step?.kind} data-block={step?.block} data-mode={repsStep ? "reps" : "time"}>
      <div className="fit-player__top">
        <button type="button" className="fit-icon-btn" aria-label="Salir del entrenamiento" onClick={openExit}>
          <CloseOutlined />
        </button>
        <span className="fit-player__where">{whereText(step)}</span>
        <span className="fit-player__clock" title="Tiempo activo">
          {clock(E.activeTime(s, now), "down")}
        </span>
        <button
          type="button"
          className="fit-icon-btn"
          aria-pressed={prefs.voice}
          aria-label={prefs.voice ? "Silenciar la voz" : "Prender la voz"}
          onClick={() => updatePrefs({ voice: !prefs.voice })}
        >
          {prefs.voice ? <SoundOutlined /> : <MutedOutlined />}
        </button>
        <button type="button" className="fit-icon-btn" aria-label="Cómo se hace este ejercicio" onClick={openHelp}>
          <QuestionCircleOutlined />
        </button>
      </div>
      <div className="fit-player__bar" aria-hidden="true">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="fit-sr" aria-live="polite">
        {`${phaseText(steps, s.index)}: ${ex?.name ?? ""}. ${isWork ? stepLine(step, false) : line}`}
      </div>

      <main className="fit-player__stage">
        <div className={`fit-player__visual${isWork ? "" : " fit-player__visual--next"}`}>
          {ex && <ExerciseFigure key={ex.key} figure={ex.figure} label={`Cómo se hace: ${ex.name}`} animate={!paused} />}
          {!isWork && <span className="fit-player__badge">Sigue</span>}
        </div>
        <div className="fit-player__info">
          <div className="fit-player__phase">
            {phaseText(steps, s.index)}
            {paused ? " · en pausa" : ""}
          </div>
          <h1 className="fit-player__name">{ex?.name ?? ""}</h1>
          {line && <div className="fit-player__label">{line}</div>}

          {repsStep ? (
            <div className="fit-reps">
              <div className="fit-reps__goal">
                <span className="fit-reps__num">{step.reps ?? 10}</span>
                <span className="fit-reps__unit">{step.perSide ? "por lado" : "repeticiones"}</span>
              </div>
              {adjust}
              {last && <span className="fit-hint">La última vez: {lastText(last.sets)}</span>}
              <Button type="primary" size="large" icon={<CheckOutlined />} className="fit-done-btn" onClick={markDone}>
                Listo
              </Button>
              <span className="fit-hint fit-num">{clock(elapsed, "down")}</span>
            </div>
          ) : (
            <>
              <CountdownRing leftMs={left} totalMs={s.durMs} sub={ringSub} />
              {!isWork ? (
                <Button icon={<PlusOutlined />} onClick={addTen}>
                  10 s
                </Button>
              ) : step.emom ? (
                <>
                  {adjust}
                  {last && <span className="fit-hint">La última vez: {lastText(last.sets)}</span>}
                </>
              ) : (
                <>
                  {usesWeight && adjust}
                  <Button type="link" onClick={markDone}>
                    Terminé antes
                  </Button>
                </>
              )}
            </>
          )}
          {isWork && nextText && <span className="fit-hint">Después: {nextText}</span>}
        </div>
      </main>

      <div className="fit-player__controls">
        <button type="button" className="fit-roundbtn" aria-label="Repetir o volver al anterior" onClick={backStep}>
          <StepBackwardOutlined />
        </button>
        <button type="button" className="fit-roundbtn fit-roundbtn--main" aria-label={paused ? "Seguir" : "Pausar"} onClick={togglePause}>
          {paused ? <CaretRightOutlined /> : <PauseOutlined />}
        </button>
        <button type="button" className="fit-roundbtn" aria-label={isWork ? "Saltar este ejercicio" : "Saltar el descanso"} onClick={skipStep}>
          <StepForwardOutlined />
        </button>
      </div>

      <ExerciseSheet exercise={sheetKey ? (byKey.get(sheetKey) ?? null) : null} lib={lib} onClose={() => setSheetKey(null)} onOpen={setSheetKey} />

      <Modal
        open={exitOpen}
        title="¿Salir del entrenamiento?"
        onCancel={() => setExitOpen(false)}
        footer={
          <div className="fit-actions fit-actions--end">
            <Button onClick={() => setExitOpen(false)}>Seguir entrenando</Button>
            <Button onClick={leave}>Salir</Button>
            {doneSoFar > 0 && (
              <Button type="primary" onClick={saveAndEnd}>
                Guardar y terminar
              </Button>
            )}
          </div>
        }
      >
        <p style={{ margin: 0 }}>
          {doneSoFar > 0
            ? `Llevas ${doneSoFar} ${doneSoFar === 1 ? "ejercicio" : "ejercicios"}. Guárdalos ahora, o sal y sigue después donde ibas.`
            : "Si sales, puedes seguir después donde ibas."}
        </p>
      </Modal>
    </div>
  );
}
