import { CheckOutlined, DeleteOutlined, LeftOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Modal, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiErrorMessage } from "../../habitfer/format";
import { deleteWorkout, fetchHome, saveFitSettings } from "../api";
import { ActivityModal } from "../components/ActivityModal";
import { ExerciseFigure } from "../components/ExerciseFigure";
import { StreakCard } from "../components/StreakCard";
import { dayLabel, fullDate, minutesText, shiftDay, todayKey } from "../format";
import { useLibrary } from "../hooks";
import { FF_BASE } from "../layouts/FerFitShell";
import type { Exercise, Home, Routine, Workout } from "../types";

/** La figura de un ejercicio de la rutina, para reconocerla de un vistazo. */
function Thumb({ ex }: { ex?: Exercise }) {
  return <span className="fit-rcard__fig">{ex ? <ExerciseFigure figure={ex.figure} label="" animate={false} /> : null}</span>;
}

/** Hoy: la racha de la semana, lo que chuleaste y qué entrenar. */
export function FitTodayPage() {
  const navigate = useNavigate();
  const { lib, byKey } = useLibrary();
  const [date, setDate] = useState<string>(todayKey());
  const [home, setHome] = useState<Home | null>(null);
  const [failed, setFailed] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [modal, holder] = Modal.useModal();

  const load = useCallback(async () => {
    try {
      setHome(await fetchHome(date));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = home?.today ?? todayKey();
  const label = dayLabel(date, today);

  const setGoal = async (days: number) => {
    setSavingGoal(true);
    try {
      await saveFitSettings(days);
      await load();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo cambiar la meta"));
    } finally {
      setSavingGoal(false);
    }
  };

  const remove = (w: Workout) =>
    modal.confirm({
      title: `¿Quitar «${w.name}»?`,
      content: "Deja de contar para la racha. Las rutinas no se borran.",
      okText: "Quitar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteWorkout(w.id);
          await load();
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo quitar"));
        }
      },
    });

  const openWorkout = (w: Workout) => {
    if (w.routineId) navigate(`${FF_BASE}/rutinas/${w.routineId}?fecha=${w.date}`);
    else if (w.readyKey) navigate(`${FF_BASE}/listas/${w.readyKey}?fecha=${w.date}`);
  };

  const routineCard = (r: Routine) => (
    <button key={r.id} type="button" className="fit-rcard" onClick={() => navigate(`${FF_BASE}/rutinas/${r.id}?fecha=${date}`)}>
      <Thumb ex={byKey.get(r.items.find((i) => byKey.get(i.exerciseKey)?.focus !== "cardio")?.exerciseKey ?? r.items[0]?.exerciseKey ?? "")} />
      <span className="fit-rcard__body">
        <span className="fit-rcard__name">{r.name}</span>
        <span className="fit-rcard__meta">
          {minutesText(r.minutes)} · {r.items.length} ejercicios{r.circuit ? ` · circuito × ${r.rounds}` : ""}
        </span>
      </span>
    </button>
  );

  const starters = (lib?.ready ?? []).filter((r) => ["empieza-aqui", "bajo-impacto-25", "movilidad-manana"].includes(r.key));

  return (
    <>
      {holder}
      <div className="fit-pagehead">
        <div>
          <div className="fit-eyebrow">{date === today || date === shiftDay(today, -1) ? fullDate(date) : "Otro día"}</div>
          <h1 className="fit-title">{label}</h1>
        </div>
        <div className="fit-daynav" aria-label="Cambiar de día">
          <button type="button" className="fit-icon-btn" aria-label="Día anterior" onClick={() => setDate((d) => shiftDay(d, -1))}>
            <LeftOutlined />
          </button>
          <button type="button" className="fit-icon-btn" aria-label="Día siguiente" disabled={date >= today} onClick={() => setDate((d) => shiftDay(d, 1))}>
            <RightOutlined />
          </button>
          {date !== today && (
            <Button size="small" onClick={() => setDate(today)}>
              Volver a hoy
            </Button>
          )}
        </div>
      </div>

      {failed && !home && <div className="fit-empty">No se pudo cargar. Revisa la conexión e intenta de nuevo.</div>}
      {!failed && !home && <div className="fit-empty">Cargando…</div>}

      {home && (
        <div className="fit-split">
          <div className="fit-split__main">
            <StreakCard streak={home.streak} today={today} saving={savingGoal} onGoal={(d) => void setGoal(d)} />

            <section className="fit-section" aria-labelledby="fit-done-title">
              <div className="fit-section__head">
                <h2 className="fit-h2" id="fit-done-title">
                  {date === today ? "Lo de hoy" : "Lo de ese día"}
                </h2>
                <Button icon={<PlusOutlined />} onClick={() => setActivityOpen(true)}>
                  Otra actividad
                </Button>
              </div>
              {home.workouts.length === 0 ? (
                <div className="fit-empty">
                  {date === today ? "Aún no has chuleado nada hoy. Escoge una rutina y marca lo que hagas." : "Ese día no se anotó nada."}
                </div>
              ) : (
                <ul className="fit-exlist">
                  {home.workouts.map((w) => {
                    const done = w.items?.filter((i) => i.done).length ?? 0;
                    const total = w.items?.length ?? 0;
                    return (
                      <li key={w.id} className={`fit-ex fit-ex--row${w.counts ? " is-done" : ""}`}>
                        <button type="button" className="fit-ex__open" onClick={() => openWorkout(w)} disabled={w.kind !== "ROUTINE"}>
                          <span className="fit-h3">
                            {w.counts && <CheckOutlined className="fit-ok" />}
                            {w.name}
                          </span>
                          <span className="fit-hint">
                            {[
                              w.kind === "ACTIVITY" ? `${w.minutes ?? 0} min` : w.completed ? `Completa · ${total} ejercicios` : `${done} de ${total} ejercicios`,
                              w.kind === "ROUTINE" && w.minutes ? `${w.minutes} min` : "",
                              w.effort ? `esfuerzo ${w.effort}/10` : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                        <button type="button" className="fit-icon-btn fit-icon-btn--sm" aria-label={`Quitar ${w.name}`} onClick={() => remove(w)}>
                          <DeleteOutlined />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <div className="fit-split__side">
            <section className="fit-section" aria-labelledby="fit-train-title">
              <div className="fit-section__head">
                <h2 className="fit-h2" id="fit-train-title">
                  Entrenar
                </h2>
                <Button type="link" onClick={() => navigate(`${FF_BASE}/rutinas`)}>
                  Todas las rutinas
                </Button>
              </div>
              {home.routines.length > 0 ? (
                <div className="fit-stack">{home.routines.slice(0, 4).map(routineCard)}</div>
              ) : (
                <>
                  <p className="fit-hint" style={{ margin: 0 }}>
                    Para empezar, una rutina lista. Después puedes copiarla y cambiarla, o armar la tuya.
                  </p>
                  <div className="fit-stack">
                    {starters.map((r) => (
                      <button key={r.key} type="button" className="fit-rcard" onClick={() => navigate(`${FF_BASE}/listas/${r.key}?fecha=${date}`)}>
                        <Thumb ex={byKey.get(r.items[1]?.key ?? r.items[0]?.key ?? "")} />
                        <span className="fit-rcard__body">
                          <span className="fit-rcard__name">{r.name}</span>
                          <span className="fit-rcard__summary">{r.summary}</span>
                          <span className="fit-rcard__meta">
                            {minutesText(r.minutes)} · {r.items.length} ejercicios
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      )}

      {home && (
        <ActivityModal
          open={activityOpen}
          date={date}
          dayText={label.toLowerCase()}
          activities={home.activities}
          onClose={() => setActivityOpen(false)}
          onSaved={() => void load()}
        />
      )}
    </>
  );
}
