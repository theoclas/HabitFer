import { CaretRightOutlined, CheckOutlined, EditOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Drawer, Modal, Segmented, Select, Switch, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchRoutines, fetchWeek, moveRoutine, saveFitSettings, savePlan, startProgram, stopProgram, undoMove } from "../api";
import { sourceText } from "../components/PlanTodayCard";
import { LEVEL_LABELS, WEEKDAY_LONG, WEEKDAY_SHORT, dayTitle, fullDate, minutesText, shiftDay, weekRange, weekdayName } from "../format";
import { useLibrary } from "../hooks";
import { FF_BASE } from "../layouts/FerFitShell";
import type { DayItem, FitSettings, Program, Routine, Week } from "../types";

/** Horas del recordatorio, cada media hora de 5:00 a 22:30. */
const TIMES = Array.from({ length: 36 }, (_, i) => {
  const h = 5 + Math.floor(i / 2);
  const v = `${String(h).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
  return { value: v, label: v };
});

const refValue = (r: { routineId: string | null; readyKey: string | null }) => (r.routineId ? `r:${r.routineId}` : r.readyKey ? `l:${r.readyKey}` : "");

function statusText(i: DayItem, date: string): string {
  if (i.status === "done") return i.doneOn && i.doneOn !== date ? `Hecha el ${weekdayName(i.doneOn)}` : "Hecha";
  if (i.status === "missed") return "No se hizo";
  return "";
}

/** La semana: qué toca cada día, mover una rutina de día, el plan, los programas y el recordatorio. */
export function FitWeekPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { lib } = useLibrary();
  const [date, setDate] = useState<string | undefined>(undefined);
  const [week, setWeek] = useState<Week | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [moving, setMoving] = useState<{ item: DayItem; date: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftPlan, setDraftPlan] = useState<string[]>([]);
  const [programKey, setProgramKey] = useState<string | null>(null);
  const [modal, holder] = Modal.useModal();

  const load = useCallback(async () => {
    try {
      setWeek(await fetchWeek(date));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetchRoutines()
      .then(setRoutines)
      .catch(() => undefined);
  }, []);

  /** Guarda algo que devuelve la semana actualizada. */
  const run = async (p: () => Promise<Week>, ok?: string) => {
    setBusy(true);
    try {
      const w = await p();
      setWeek((cur) => (cur && cur.monday !== w.monday ? cur : w));
      if (ok) message.success(ok);
      return true;
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (patch: Partial<FitSettings>) => {
    try {
      const s = await saveFitSettings(patch);
      setWeek((cur) => (cur ? { ...cur, settings: s } : cur));
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    }
  };

  const planOptions = useMemo(
    () => [
      { label: "Descanso", value: "" },
      ...(routines.length ? [{ label: "Mis rutinas", options: routines.map((r) => ({ label: r.name, value: `r:${r.id}` })) }] : []),
      { label: "Rutinas listas", options: (lib?.ready ?? []).map((r) => ({ label: r.name, value: `l:${r.key}` })) },
    ],
    [routines, lib],
  );

  if (failed && !week) return <div className="fit-empty">No se pudo cargar tu semana. Revisa la conexión.</div>;
  if (!week) return <div className="fit-empty">Cargando…</div>;

  const today = week.today;
  const isThisWeek = today >= week.monday && today <= week.sunday;
  const hasTemplate = week.template.some((t) => t.name !== null);
  const program = week.program;
  const programDef = program ? lib?.programs?.find((p) => p.key === program.key) : undefined;
  const openEditor = () => {
    setDraftPlan(week.template.map((t) => refValue(t)));
    setEditing(true);
  };
  const savePlanDraft = async () => {
    const days = draftPlan.flatMap<{ weekday: number; routineId?: string; readyKey?: string }>((v, weekday) =>
      v.startsWith("r:") ? [{ weekday, routineId: v.slice(2) }] : v.startsWith("l:") ? [{ weekday, readyKey: v.slice(2) }] : [],
    );
    if (await run(() => savePlan(days), "Plan guardado")) setEditing(false);
  };
  const confirmStop = () =>
    modal.confirm({
      title: program?.status === "finished" ? "¿Quitar el programa terminado?" : `¿Dejar «${program?.name}»?`,
      content: "Desde hoy vuelve tu plan de la semana. Lo que ya hiciste queda en tu historial y en tu racha.",
      okText: program?.status === "finished" ? "Quitar" : "Dejar el programa",
      okButtonProps: { danger: program?.status !== "finished" },
      cancelText: "Cancelar",
      onOk: () => run(stopProgram, program?.status === "finished" ? undefined : "Dejaste el programa"),
    });

  return (
    <>
      {holder}
      <div className="fit-pagehead">
        <div>
          <div className="fit-eyebrow">{isThisWeek ? "Esta semana" : today < week.monday ? "Más adelante" : "Semana pasada"}</div>
          <h1 className="fit-title">Tu semana</h1>
          <p className="fit-sub">{weekRange(week.monday, week.sunday)}</p>
        </div>
        <div className="fit-daynav" aria-label="Cambiar de semana">
          <button type="button" className="fit-icon-btn" aria-label="Semana anterior" onClick={() => setDate(shiftDay(week.monday, -7))}>
            <LeftOutlined />
          </button>
          <button type="button" className="fit-icon-btn" aria-label="Semana siguiente" onClick={() => setDate(shiftDay(week.monday, 7))}>
            <RightOutlined />
          </button>
          {!isThisWeek && (
            <Button size="small" onClick={() => setDate(undefined)}>
              Esta semana
            </Button>
          )}
        </div>
      </div>

      <div className="fit-split">
        <div className="fit-split__main">
          {program && (
            <section className="fit-card fit-programbar" aria-label="Tu programa">
              <div className="fit-section__head">
                <div>
                  <div className="fit-eyebrow">Programa</div>
                  <div className="fit-h3">{program.name}</div>
                </div>
                <Button size="small" onClick={confirmStop}>
                  {program.status === "finished" ? "Quitar" : "Dejar"}
                </Button>
              </div>
              <span className="fit-hint">
                {program.status === "upcoming"
                  ? `Empieza el ${fullDate(program.startDate)}.`
                  : program.status === "finished"
                    ? "¡Terminaste el programa! Puedes empezar otro abajo."
                    : `Semana ${program.currentWeek} de ${program.weeks}${programDef ? `: ${programDef.weekNotes[program.currentWeek - 1] ?? ""}` : ""}`}
              </span>
              <div className="fit-progress" aria-hidden="true">
                <span style={{ width: `${program.total ? (program.done / program.total) * 100 : 0}%` }} />
              </div>
              <span className="fit-hint fit-num">
                {program.done} de {program.total} sesiones · {program.weekdays.map((d) => WEEKDAY_SHORT[d]).join(" ")}
              </span>
            </section>
          )}

          {!hasTemplate && !program ? (
            <div className="fit-empty">
              Aún no tienes plan. Escoge qué rutina toca cada día o sigue un programa de varias semanas.
              <div className="fit-actions" style={{ justifyContent: "center" }}>
                <Button type="primary" icon={<EditOutlined />} onClick={openEditor}>
                  Armar mi semana
                </Button>
                <Button onClick={() => document.getElementById("fit-programs")?.scrollIntoView({ behavior: "smooth" })}>Ver programas</Button>
              </div>
            </div>
          ) : null}

          <ol className="fit-days" aria-label="Los días de la semana">
            {week.days.map((d) => {
              const past = d.date < today;
              return (
                <li key={d.date} className={`fit-day${d.date === today ? " is-today" : ""}${past ? " is-past" : ""}`}>
                  <div className="fit-day__head">
                    <span className="fit-day__name">{dayTitle(d.date)}</span>
                    {d.date === today && <span className="fit-tag fit-tag--low">Hoy</span>}
                  </div>
                  {d.items.length === 0 ? (
                    <span className="fit-hint">Descanso</span>
                  ) : (
                    d.items.map((i) => {
                      const extra = [i.minutes ? minutesText(i.minutes) : "", statusText(i, d.date), sourceText(i)].filter(Boolean).join(" · ");
                      const canMove = i.exists && i.status !== "done" && week.days.some((x) => x.date >= today && x.date !== d.date);
                      return (
                        <div key={`${i.routineId ?? i.readyKey}-${i.moveId ?? i.source}`} className="fit-day__item" data-status={i.status}>
                          <button type="button" className="fit-day__body" onClick={() => navigate(i.path)}>
                            <span className="fit-day__routine">
                              {i.status === "done" && <CheckOutlined className="fit-ok" />}
                              {i.name}
                            </span>
                            {extra && <span className="fit-hint">{extra}</span>}
                          </button>
                          <div className="fit-day__actions">
                            {i.status === "today" && i.exists && (
                              <Button size="small" type="primary" icon={<CaretRightOutlined />} onClick={() => navigate(`${i.path}/entrenar`)}>
                                Empezar
                              </Button>
                            )}
                            {i.status === "missed" && i.exists && isThisWeek && (
                              <Button
                                size="small"
                                loading={busy}
                                onClick={() => void run(() => moveRoutine({ from: d.date, to: today, routineId: i.routineId, readyKey: i.readyKey }), "Quedó para hoy")}
                              >
                                Pasarla a hoy
                              </Button>
                            )}
                            {canMove && (
                              <Button size="small" onClick={() => setMoving({ item: i, date: d.date })}>
                                Mover
                              </Button>
                            )}
                            {i.source === "move" && i.moveId && i.status !== "done" && (
                              <Button size="small" type="link" onClick={() => void run(() => undoMove(i.moveId!), "Volvió a su día")}>
                                Deshacer
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="fit-split__side">
          <section className="fit-card" aria-labelledby="fit-plan-title">
            <div className="fit-section__head">
              <h2 className="fit-h2" id="fit-plan-title">
                Plan de la semana
              </h2>
              <Button size="small" icon={<EditOutlined />} onClick={openEditor}>
                Editar
              </Button>
            </div>
            {week.planPaused && hasTemplate && <div className="fit-tip">Mientras sigues el programa, tu plan queda en pausa.</div>}
            <ul className="fit-planlist">
              {week.template.map((t) => (
                <li key={t.weekday}>
                  <span className="fit-planlist__day">{WEEKDAY_LONG[t.weekday]}</span>
                  <span className={t.name ? "" : "fit-hint"}>{t.name ? `${t.name}${t.exists ? "" : " (ya no existe)"}` : "Descanso"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="fit-card" aria-label="Recordatorio">
            <div className="fit-switch">
              <label htmlFor="fit-sw-remind">
                <b>Recordatorio</b>
                <small>Los días que te toca entrenar, si aún no lo has hecho.</small>
              </label>
              <Switch id="fit-sw-remind" checked={week.settings.remindOn} onChange={(v) => void saveSettings({ remindOn: v })} />
            </div>
            {week.settings.remindOn && (
              <div className="fit-actions">
                <label className="fit-hint" htmlFor="fit-remind-at">
                  A las
                </label>
                <Select id="fit-remind-at" size="small" value={week.settings.remindAt} options={TIMES} onChange={(v) => void saveSettings({ remindAt: v })} style={{ width: 100 }} />
              </div>
            )}
            <span className="fit-hint">
              Llega como notificación al celular y queda en la campana. Si tienes el correo o WhatsApp con todos los avisos en HabitFer › Notificaciones, también
              llega por ahí.
            </span>
          </section>
        </div>
      </div>

      <section className="fit-section" id="fit-programs" aria-labelledby="fit-programs-title">
        <h2 className="fit-h2" id="fit-programs-title">
          Programas de varias semanas
        </h2>
        <p className="fit-hint" style={{ margin: 0 }}>
          Se ponen solos en los días que escojas y suben de a poco cada semana. Mientras sigues uno, tu plan de la semana queda en pausa.
        </p>
        <div className="fit-grid">
          {(lib?.programs ?? []).map((p) => (
            <article key={p.key} className="fit-card fit-program">
              <div className="fit-eyebrow">
                {p.weeks} semanas · {p.daysPerWeek} días por semana · {LEVEL_LABELS[p.level]}
              </div>
              <h3 className="fit-h3">{p.name}</h3>
              <p className="fit-hint" style={{ margin: 0 }}>
                {p.summary}
              </p>
              <div className="fit-actions">
                <Button type={program?.key === p.key && program.status !== "finished" ? "default" : "primary"} onClick={() => setProgramKey(p.key)}>
                  {program?.key === p.key && program.status !== "finished" ? "Ver el programa" : "Ver y empezar"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Modal open={!!moving} title={moving ? `Mover «${moving.item.name}»` : ""} footer={null} onCancel={() => setMoving(null)}>
        {moving && (
          <div className="fit-sheet">
            <span className="fit-hint">Escoge el día de esta semana al que pasa.</span>
            <div className="fit-movegrid">
              {week.days
                .filter((d) => d.date >= today && d.date !== moving.date)
                .map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    className="fit-chip"
                    disabled={busy}
                    onClick={async () => {
                      if (await run(() => moveRoutine({ from: moving.date, to: d.date, routineId: moving.item.routineId, readyKey: moving.item.readyKey }), `Quedó para el ${weekdayName(d.date)}`))
                        setMoving(null);
                    }}
                  >
                    {d.date === today ? `Hoy · ${weekdayName(d.date)}` : dayTitle(d.date)}
                    {d.items.length ? <small> · ya tiene {d.items.length}</small> : null}
                  </button>
                ))}
            </div>
          </div>
        )}
      </Modal>

      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title="Plan de la semana"
        placement={isMobile ? "bottom" : "right"}
        size={isMobile ? "88dvh" : 480}
        rootClassName="fit-drawer"
        footer={
          <div className="fit-actions fit-actions--end">
            <Button onClick={() => setEditing(false)}>Cancelar</Button>
            <Button type="primary" loading={busy} onClick={() => void savePlanDraft()}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="fit-sheet">
          <span className="fit-hint">Escoge qué rutina toca cada día. Los días sin rutina son de descanso.</span>
          {WEEKDAY_LONG.map((name, wd) => (
            <div key={name} className="fit-field">
              <label className="fit-label" htmlFor={`fit-plan-${wd}`}>
                {name}
              </label>
              <Select
                id={`fit-plan-${wd}`}
                value={draftPlan[wd] ?? ""}
                options={planOptions}
                showSearch
                optionFilterProp="label"
                onChange={(v: string) => setDraftPlan((cur) => cur.map((x, i) => (i === wd ? v : x)))}
              />
            </div>
          ))}
        </div>
      </Drawer>

      <ProgramModal
        program={lib?.programs?.find((p) => p.key === programKey) ?? null}
        current={program}
        today={today}
        busy={busy}
        onClose={() => setProgramKey(null)}
        onStart={async (input) => {
          if (await run(() => startProgram(input), "¡Programa en marcha! Ya está en tu semana")) {
            setProgramKey(null);
            setDate(undefined);
          }
        }}
        onOpenSession={(key) => navigate(`${FF_BASE}/listas/${key}`)}
      />
    </>
  );
}

function ProgramModal({
  program,
  current,
  today,
  busy,
  onClose,
  onStart,
  onOpenSession,
}: {
  program: Program | null;
  current: Week["program"];
  today: string;
  busy: boolean;
  onClose: () => void;
  onStart: (input: { programKey: string; weekdays: number[]; start: "this" | "next" }) => void;
  onOpenSession: (key: string) => void;
}) {
  const [days, setDays] = useState<number[]>([]);
  // Desde el jueves, por defecto empieza el lunes que viene.
  const lateInWeek = (() => {
    const [y, m, d] = today.split("-").map(Number);
    const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    return wd >= 3;
  })();
  const [start, setStart] = useState<"this" | "next">(lateInWeek ? "next" : "this");

  useEffect(() => {
    if (program) {
      setDays(program.suggestedDays);
      setStart(lateInWeek ? "next" : "this");
    }
  }, [program, lateInWeek]);

  if (!program) return null;
  const running = current && current.key === program.key && current.status !== "finished";
  const toggle = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : cur.length >= program.daysPerWeek ? cur : [...cur, d].sort((a, b) => a - b)));

  return (
    <Modal
      open
      title={program.name}
      onCancel={onClose}
      footer={
        running ? (
          <Button onClick={onClose}>Cerrar</Button>
        ) : (
          <div className="fit-actions fit-actions--end">
            <Button onClick={onClose}>Cancelar</Button>
            <Button
              type="primary"
              loading={busy}
              disabled={days.length !== program.daysPerWeek}
              onClick={() => onStart({ programKey: program.key, weekdays: days, start })}
            >
              Empezar el programa
            </Button>
          </div>
        )
      }
    >
      <div className="fit-sheet">
        <span className="fit-hint">{program.summary}</span>
        <ol className="fit-weeknotes">
          {program.weekNotes.map((n, i) => (
            <li key={i}>
              <b>Semana {i + 1}:</b> {n}{" "}
              <span className="fit-weeknotes__sessions">
                {program.sessions[i].map((s) => (
                  <button key={s.key} type="button" className="fit-linkbtn" onClick={() => onOpenSession(s.key)}>
                    {s.name.replace(/^Semana \d+ · /, "")}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ol>
        {running ? (
          <div className="fit-tip">Ya lo estás siguiendo: va en tu semana.</div>
        ) : (
          <>
            {current && current.status !== "finished" && <div className="fit-tip">Vas a dejar «{current.name}»; lo que hiciste queda en tu historial.</div>}
            <div className="fit-field">
              <span className="fit-label" id="fit-prog-days">
                Escoge {program.daysPerWeek} días de la semana
              </span>
              <div className="fit-chips" role="group" aria-labelledby="fit-prog-days" style={{ flexWrap: "wrap" }}>
                {WEEKDAY_LONG.map((name, d) => (
                  <button key={name} type="button" className="fit-chip" aria-pressed={days.includes(d)} onClick={() => toggle(d)}>
                    {name}
                  </button>
                ))}
              </div>
              <span className="fit-hint">
                {days.length}/{program.daysPerWeek} días. Mejor dejar un día de descanso entre uno y otro.
              </span>
            </div>
            <div className="fit-field">
              <span className="fit-label" id="fit-prog-start">
                Cuándo empiezas
              </span>
              <Segmented
                aria-labelledby="fit-prog-start"
                value={start}
                onChange={(v) => setStart(v as "this" | "next")}
                options={[
                  { value: "this", label: "Esta semana" },
                  { value: "next", label: "El próximo lunes" },
                ]}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
