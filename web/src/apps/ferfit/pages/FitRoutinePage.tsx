import { CaretRightOutlined, CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Modal, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiErrorMessage } from "../../habitfer/format";
import { copyReadyRoutine, deleteRoutine, fetchHistory, fetchRoutine, fetchWorkouts, saveWorkout, updateRoutine } from "../api";
import { ExerciseFigure } from "../components/ExerciseFigure";
import { ExerciseSheet } from "../components/ExerciseSheet";
import { SwapModal } from "../components/SwapModal";
import { VideoBlock } from "../components/VideoBlock";
import { LEVEL_LABELS, dayLabel, doseText, lastText, minutesText, restText, todayKey } from "../format";
import { findReady, fitSettings, useLibrary, waitsForPrograms } from "../hooks";
import { FF_BASE } from "../layouts/FerFitShell";
import { readSession } from "../player/storage";
import { swapDose } from "../similar";
import type { Exercise, History, Routine, Workout } from "../types";

type Item = { exerciseKey: string; sets: number; reps: number | null; seconds: number | null; restSeconds: number };

/** Una rutina (propia o lista): sus ejercicios, cómo se hace cada uno y chulear lo que hiciste ese día. */
export function FitRoutinePage() {
  const { id, key } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { lib, byKey } = useLibrary();
  const [own, setOwn] = useState<Routine | null>(null);
  const [missing, setMissing] = useState(false);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<History>({});
  const [swapAt, setSwapAt] = useState<number | null>(null);
  const [swapping, setSwapping] = useState(false);
  const has = fitSettings.use()?.equipment ?? null;
  const [modal, holder] = Modal.useModal();

  const today = todayKey();
  const wanted = params.get("fecha");
  const date = wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) && wanted <= today ? wanted : today;
  const ready = findReady(lib, key);

  useEffect(() => {
    if (!id) return;
    fetchRoutine(id)
      .then(setOwn)
      .catch(() => setMissing(true));
  }, [id]);

  const loadWorkout = useCallback(async () => {
    try {
      const list = await fetchWorkouts(date, date);
      const w = list.find((x) => x.kind === "ROUTINE" && (id ? x.routineId === id : x.readyKey === key)) ?? null;
      setWorkout(w);
      setDone(new Set((w?.items ?? []).flatMap((it, i) => (it.done ? [i] : []))));
    } catch {
      /* sin lo chuleado: se puede marcar igual */
    }
  }, [date, id, key]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  const view = useMemo(() => {
    if (own) return { name: own.name, text: own.notes, circuit: own.circuit, rounds: own.rounds, minutes: own.minutes, level: null as number | null, items: own.items as Item[] };
    if (ready)
      return {
        name: ready.name,
        text: ready.summary,
        circuit: ready.circuit,
        rounds: ready.rounds,
        minutes: ready.minutes,
        level: ready.level as number | null,
        items: ready.items.map<Item>((i) => ({ exerciseKey: i.key, sets: i.sets, reps: i.reps ?? null, seconds: i.seconds ?? null, restSeconds: i.rest })),
      };
    return null;
  }, [own, ready]);

  const target = id ? { routineId: id } : { readyKey: key };
  const itemKeys = view ? view.items.map((i) => i.exerciseKey).join(",") : "";
  useEffect(() => {
    if (!itemKeys) return;
    fetchHistory(itemKeys.split(","))
      .then(setHistory)
      .catch(() => undefined);
  }, [itemKeys]);
  // Un entrenamiento guiado que quedó a medias con esta rutina.
  const pending = useMemo(() => readSession(id ? `r:${id}` : `l:${key ?? ""}`), [id, key]);
  const playUrl = `${FF_BASE}/${id ? `rutinas/${id}` : `listas/${key}`}/entrenar${date !== today ? `?fecha=${date}` : ""}`;

  const save = async (next: Set<number>, completed?: boolean) => {
    const prev = done;
    setDone(next);
    setSaving(true);
    try {
      const w = await saveWorkout({ date, kind: "ROUTINE", ...target, ...(completed === undefined ? { done: [...next] } : { completed }) });
      setWorkout(w);
      setDone(new Set((w.items ?? []).flatMap((it, i) => (it.done ? [i] : []))));
    } catch (err) {
      setDone(prev);
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (i: number) => {
    const next = new Set(done);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    void save(next);
  };

  const total = view?.items.length ?? 0;
  const allDone = total > 0 && done.size === total;

  const markAll = async () => {
    const next = allDone ? new Set<number>() : new Set(view?.items.map((_, i) => i) ?? []);
    await save(next, !allDone);
    if (!allDone) message.success("¡Hecha! Cuenta para tu racha.");
  };

  const copy = async () => {
    if (!key) return;
    setBusy(true);
    try {
      const r = await copyReadyRoutine(key);
      message.success("Copiada a tus rutinas: ahora la puedes cambiar.");
      navigate(`${FF_BASE}/rutinas/${r.id}/editar`);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo copiar"));
    } finally {
      setBusy(false);
    }
  };

  /** Cambiar un ejercicio por otro parecido. En una lista se guarda una copia en tus rutinas con el cambio. */
  const swap = async (ex: Exercise) => {
    if (swapAt === null || !view) return;
    const items = view.items.map((it, i) => {
      const base = { exerciseKey: it.exerciseKey, sets: it.sets, reps: it.reps, seconds: it.seconds, restSeconds: it.restSeconds };
      return i === swapAt ? { ...base, exerciseKey: ex.key, ...swapDose(it, ex) } : base;
    });
    setSwapping(true);
    try {
      if (own) {
        setOwn(await updateRoutine(own.id, { name: own.name, notes: own.notes, circuit: own.circuit, rounds: own.rounds, items }));
        message.success(`Listo: ahora haces «${ex.name}»`);
      } else if (key) {
        const copy = await copyReadyRoutine(key);
        await updateRoutine(copy.id, { name: copy.name, notes: copy.notes, circuit: copy.circuit, rounds: copy.rounds, items });
        message.success(`Quedó en tus rutinas con «${ex.name}»`);
        navigate(`${FF_BASE}/rutinas/${copy.id}`);
      }
      setSwapAt(null);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo cambiar"));
    } finally {
      setSwapping(false);
    }
  };

  const remove = () =>
    modal.confirm({
      title: `¿Borrar «${view?.name}»?`,
      content: "Sale de tus rutinas. Lo que ya hiciste con ella se queda en tu historial y en tu racha.",
      okText: "Borrar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteRoutine(id!);
          message.success("Rutina borrada");
          navigate(`${FF_BASE}/rutinas`);
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo borrar"));
        }
      },
    });

  if (missing || (key && lib && !ready && !waitsForPrograms(lib, key))) {
    return (
      <div className="fit-empty">
        Esa rutina ya no existe.
        <Button onClick={() => navigate(`${FF_BASE}/rutinas`)}>Ver las rutinas</Button>
      </div>
    );
  }
  if (!view || !lib) return <div className="fit-empty">Cargando…</div>;

  const open = openKey ? (byKey.get(openKey) ?? null) : null;

  return (
    <>
      {holder}
      <div className="fit-pagehead">
        <div style={{ minWidth: 0 }}>
          <div className="fit-eyebrow">{id ? "Mi rutina" : "Rutina lista"}</div>
          <h1 className="fit-title">{view.name}</h1>
          {view.text && <p className="fit-sub">{view.text}</p>}
        </div>
        <div className="fit-actions">
          <Button type="primary" icon={<CaretRightOutlined />} onClick={() => navigate(playUrl)}>
            {pending ? "Seguir donde ibas" : "Empezar"}
          </Button>
          {id ? (
            <>
              <Button icon={<EditOutlined />} onClick={() => navigate(`${FF_BASE}/rutinas/${id}/editar`)}>
                Editar
              </Button>
              <Button icon={<DeleteOutlined />} danger onClick={remove}>
                Borrar
              </Button>
            </>
          ) : (
            <Button icon={<CopyOutlined />} loading={busy} onClick={() => void copy()}>
              Copiar a mis rutinas
            </Button>
          )}
        </div>
      </div>

      <div className="fit-tags">
        <span className="fit-tag">{minutesText(view.minutes)}</span>
        <span className="fit-tag">{total} ejercicios</span>
        {view.level && <span className="fit-tag">{LEVEL_LABELS[view.level]}</span>}
        {view.circuit && <span className="fit-tag fit-tag--low">Circuito × {view.rounds} vueltas</span>}
      </div>

      <div className="fit-split">
        <div className="fit-split__main">
          {view.circuit && (
            <div className="fit-tip">
              Circuito: haz un ejercicio tras otro, una vez cada uno, y repite todo {view.rounds} {view.rounds === 1 ? "vez" : "veces"}.
            </div>
          )}
          <ol className="fit-exlist" aria-label="Ejercicios">
            {view.items.map((it, i) => {
              const ex = byKey.get(it.exerciseKey);
              const isDone = done.has(i);
              return (
                <li key={`${it.exerciseKey}-${i}`} className={`fit-ex${isDone ? " is-done" : ""}`}>
                  <button type="button" className="fit-ex__fig" onClick={() => setOpenKey(it.exerciseKey)} aria-label={`Ver cómo se hace ${ex?.name ?? ""}`}>
                    {ex && <ExerciseFigure figure={ex.figure} label="" />}
                  </button>
                  <div className="fit-ex__body">
                    <button type="button" className="fit-ex__name" onClick={() => setOpenKey(it.exerciseKey)}>
                      {ex?.name ?? "Ejercicio que ya no existe"}
                    </button>
                    <span className="fit-ex__dose">{doseText(it, ex?.perSide, view.circuit)}</span>
                    <span className="fit-ex__rest">{restText(it.restSeconds)}</span>
                    {history[it.exerciseKey] && <span className="fit-ex__last">La última vez: {lastText(history[it.exerciseKey].sets)}</span>}
                    {ex && (
                      <button type="button" className="fit-linkbtn fit-ex__swap" onClick={() => setSwapAt(i)} aria-label={`Cambiar ${ex.name} por otro ejercicio`}>
                        Cambiar por otro
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="fit-check"
                    aria-pressed={isDone}
                    aria-label={isDone ? `Desmarcar ${ex?.name ?? "ejercicio"}` : `Chulear ${ex?.name ?? "ejercicio"}`}
                    onClick={() => toggle(i)}
                  >
                    {isDone ? <CheckOutlined /> : null}
                  </button>
                </li>
              );
            })}
          </ol>

          <section className="fit-card" aria-labelledby="fit-video-title">
            <h2 className="fit-h2" id="fit-video-title">
              Video
            </h2>
            <VideoBlock key={id ?? key} target="routine" targetKey={(id ?? key)!} curated={key ? (lib.videos?.routines[key] ?? null) : null} what="esta rutina" />
          </section>
        </div>

        <div className="fit-split__side">
          <section className="fit-card" aria-labelledby="fit-progress-title">
            <div className="fit-section__head">
              <h2 className="fit-h2" id="fit-progress-title">
                {dayLabel(date, today)}
              </h2>
              <span className="fit-num fit-hint">
                {done.size} de {total} hechos
              </span>
            </div>
            <div className="fit-progress" aria-hidden="true">
              <span style={{ width: `${total ? (done.size / total) * 100 : 0}%` }} />
            </div>
            <Button type="primary" size="large" block icon={<CaretRightOutlined />} onClick={() => navigate(playUrl)}>
              {pending ? "Seguir donde ibas" : "Empezar entreno guiado"}
            </Button>
            <Button size="large" block icon={allDone ? undefined : <CheckOutlined />} loading={saving} onClick={() => void markAll()}>
              {allDone ? "Desmarcar todo" : "Marcar toda como hecha"}
            </Button>
            <span className="fit-hint">
              {workout?.counts || done.size > 0
                ? "Ya cuenta para tu racha de esta semana."
                : "Chulea cada ejercicio al terminarlo, o toda la rutina de una vez."}
            </span>
            <span className="fit-hint">
              El entreno guiado te lleva paso a paso con tiempos y voz, anota tus series y agrega 5 min para calentar y 5 para estirar
              (los puedes quitar).
            </span>
          </section>
        </div>
      </div>

      <ExerciseSheet exercise={open} lib={lib} onClose={() => setOpenKey(null)} onOpen={setOpenKey} />
      <SwapModal
        exercise={swapAt !== null ? (byKey.get(view.items[swapAt]?.exerciseKey ?? "") ?? null) : null}
        lib={lib}
        has={has}
        busy={swapping}
        note={id ? undefined : "Las rutinas listas no se cambian: se guarda una copia en tus rutinas con el cambio."}
        onClose={() => setSwapAt(null)}
        onPick={(ex) => void swap(ex)}
      />
    </>
  );
}
