import { DeleteOutlined, EditOutlined, FireFilled, SettingOutlined } from "@ant-design/icons";
import { Button, Drawer, Modal, Segmented, Switch, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { apiErrorMessage } from "../../habitfer/format";
import { deleteFast, fetchFasting, saveFastSettings, startFast, stopFast, updateFast } from "../api";
import type { FastingState, FastView } from "../types";

const planLabel = (h: number) => (h === 23 ? "23:1" : `${h}:${24 - h}`);

/** «13 h 05 min» */
function durationText(ms: number) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

/** Un `datetime-local` (hora de Colombia en el teléfono) ↔ ISO. */
const toLocalInput = (iso: string) => dayjs(iso).format("YYYY-MM-DDTHH:mm");
const fromLocalInput = (v: string) => dayjs(v).toISOString();

const R = 44;
const C = 2 * Math.PI * R;

/** El anillo del ayuno: cuánto va de la meta. */
function FastRing({ pct, reached }: { pct: number; reached: boolean }) {
  return (
    <svg className={`nf-fastring${reached ? " is-reached" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
      <circle className="nf-fastring__track" cx="50" cy="50" r={R} fill="none" strokeWidth="9" />
      {pct > 0 && (
        <circle
          className="nf-fastring__fill"
          cx="50"
          cy="50"
          r={R}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${Math.min(1, pct) * C} ${C}`}
          transform="rotate(-90 50 50)"
        />
      )}
    </svg>
  );
}

/**
 * Ayuno intermitente: empezar, ver cuánto va (y a qué hora llega a la meta), terminar y la racha. En la rueda se
 * eligen la meta de siempre, el aviso y se corrigen ayunos pasados.
 */
export function FastingCard() {
  const isMobile = useIsMobile();
  const [state, setState] = useState<FastingState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FastView | null>(null);
  const [modal, holder] = Modal.useModal();

  const load = useCallback(async () => {
    try {
      setState(await fetchFasting());
    } catch {
      // Sin ayuno no pasa nada: la tarjeta se queda en blanco.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // El reloj corre solo mientras hay un ayuno en curso.
  useEffect(() => {
    if (!state?.current) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [state?.current]);

  const run = async (fn: () => Promise<FastingState>, ok?: string) => {
    setBusy(true);
    try {
      setState(await fn());
      setNow(Date.now());
      if (ok) message.success(ok);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo"));
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  const goal = plan ?? state.goalHours;
  const cur = state.current;
  const elapsed = cur ? now - new Date(cur.startedAt).getTime() : 0;
  const goalMs = cur ? cur.goalHours * 3_600_000 : 0;
  const reached = cur ? elapsed >= goalMs : false;

  return (
    <section className="nf-card nf-fast" aria-labelledby="nf-fast-title">
      {holder}
      <div className="nf-card__head">
        <h2 id="nf-fast-title" className="nf-nutricard__title">
          Ayuno
        </h2>
        <span className="nf-fast__head">
          {state.streak > 0 && (
            <span className="nf-fast__streak" title={`Mejor racha: ${state.best} días`}>
              <FireFilled /> {state.streak} {state.streak === 1 ? "día" : "días"}
            </span>
          )}
          <button type="button" className="nf-icon-btn nf-icon-btn--sm" aria-label="Ajustes e historial del ayuno" onClick={() => setOpen(true)}>
            <SettingOutlined />
          </button>
        </span>
      </div>

      {cur ? (
        <div className="nf-fast__live">
          <div className="nf-fast__ring">
            <FastRing pct={elapsed / goalMs} reached={reached} />
            <div className="nf-fast__center">
              <b>{durationText(elapsed)}</b>
              <small>de {cur.goalHours} h</small>
            </div>
          </div>
          <div className="nf-fast__info">
            <p>
              {reached ? (
                <b>¡Llegaste a tu meta!</b>
              ) : (
                <>
                  Llegas a las <b>{dayjs(cur.goalAt).format("h:mm a")}</b>
                  {dayjs(cur.goalAt).isSame(dayjs(), "day") ? "" : ` del ${dayjs(cur.goalAt).format("dddd")}`}
                </>
              )}
            </p>
            <small>
              Empezó {dayjs(cur.startedAt).format("dddd h:mm a")} ·{" "}
              <button type="button" className="nf-link" onClick={() => setEditing(cur)}>
                cambiar
              </button>
            </small>
            <Button type={reached ? "primary" : "default"} loading={busy} onClick={() => void run(() => stopFast(), reached ? "Ayuno terminado: ¡bien hecho!" : "Ayuno terminado")}>
              Terminar ayuno
            </Button>
          </div>
        </div>
      ) : (
        <div className="nf-fast__idle">
          <Segmented
            size="small"
            value={goal}
            onChange={(v) => setPlan(Number(v))}
            options={state.plans.map((h) => ({ label: planLabel(h), value: h }))}
          />
          <Button type="primary" loading={busy} onClick={() => void run(() => startFast({ goalHours: goal }), `Ayuno de ${goal} horas en marcha`)}>
            Empezar ayuno
          </Button>
          <small className="nf-hint">
            {state.history[0]
              ? `El último: ${state.history[0].hours.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h${state.history[0].reached ? " ✓" : ""}.`
              : "Tócalo cuando termines de comer: cuenta desde ahí."}
          </small>
        </div>
      )}

      <Drawer
        title="Ayuno"
        open={open}
        onClose={() => setOpen(false)}
        placement={isMobile ? "bottom" : "right"}
        size={isMobile ? "80dvh" : 460}
        rootClassName="nf-drawer"
        styles={{ body: { paddingBottom: isMobile ? "max(24px, env(safe-area-inset-bottom))" : 24 } }}
      >
        <div className="nf-detail">
          <div className="nf-field">
            <span className="nf-label">Meta de siempre</span>
            <Segmented
              block
              value={state.goalHours}
              disabled={!state.canSaveSettings || busy}
              onChange={(v) => void run(() => saveFastSettings({ goalHours: Number(v) }), "Meta del ayuno guardada")}
              options={state.plans.map((h) => ({ label: planLabel(h), value: h }))}
            />
            <span className="nf-hint">
              {state.canSaveSettings ? "16:8 = 16 horas sin comer y 8 para comer." : "Para guardarla, primero arma tu meta en NutriFer › Meta."}
            </span>
          </div>
          <div className="nf-switchrow">
            <Switch
              checked={state.notify}
              disabled={!state.canSaveSettings || busy}
              onChange={(v) => void run(() => saveFastSettings({ notify: v }))}
              aria-labelledby="nf-fast-notify"
            />
            <span>
              <span id="nf-fast-notify">Avisarme al llegar a la meta</span>
              <small>Llega como notificación, si las tienes prendidas en HabitFer.</small>
            </span>
          </div>
          <div>
            <div className="nf-section-label">Últimos ayunos · mejor racha {state.best} días</div>
            {state.history.length === 0 ? (
              <div className="nf-empty">Aún no hay ayunos terminados.</div>
            ) : (
              <ul className="nf-wlist">
                {state.history.map((f) => (
                  <li key={f.id} className="nf-fastlist">
                    <span className="nf-wlist__date">{dayjs(f.startedAt).format("ddd D MMM, h:mm a").replace(/\./g, "")}</span>
                    <b>{f.hours.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h</b>
                    <span className="nf-wlist__trend">{f.reached ? `✓ ${planLabel(f.goalHours)}` : `de ${f.goalHours} h`}</span>
                    <span className="nf-wlist__tools">
                      <button type="button" className="nf-icon-btn nf-icon-btn--sm" aria-label="Corregir las horas" onClick={() => setEditing(f)}>
                        <EditOutlined />
                      </button>
                      <button
                        type="button"
                        className="nf-icon-btn nf-icon-btn--sm"
                        aria-label="Borrar este ayuno"
                        onClick={() =>
                          modal.confirm({
                            title: "¿Borrar este ayuno?",
                            okText: "Borrar",
                            okButtonProps: { danger: true },
                            cancelText: "Cancelar",
                            onOk: () => run(() => deleteFast(f.id), "Ayuno borrado"),
                          })
                        }
                      >
                        <DeleteOutlined />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Drawer>

      <EditFastModal
        fast={editing}
        onClose={() => setEditing(null)}
        onSave={(id, payload) =>
          run(async () => {
            const s = await updateFast(id, payload);
            setEditing(null);
            return s;
          }, "Ayuno corregido")
        }
      />
    </section>
  );
}

/** Corregir la hora de inicio (y de fin, si ya terminó) de un ayuno. */
function EditFastModal({
  fast,
  onClose,
  onSave,
}: {
  fast: FastView | null;
  onClose: () => void;
  onSave: (id: string, payload: { startedAt: string; endedAt?: string }) => Promise<void>;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  useEffect(() => {
    if (!fast) return;
    setStart(toLocalInput(fast.startedAt));
    setEnd(fast.endedAt ? toLocalInput(fast.endedAt) : "");
  }, [fast]);
  const max = dayjs().format("YYYY-MM-DDTHH:mm");
  return (
    <Modal
      title="Corregir el ayuno"
      open={fast !== null}
      onCancel={onClose}
      okText="Guardar"
      cancelText="Cancelar"
      onOk={() => fast && onSave(fast.id, { startedAt: fromLocalInput(start), ...(fast.endedAt && end ? { endedAt: fromLocalInput(end) } : {}) })}
      destroyOnHidden
    >
      <div className="nf-detail" style={{ gap: 12 }}>
        <label className="nf-field">
          <span className="nf-label">Empezó</span>
          <input className="nf-date nf-date--lg" type="datetime-local" value={start} max={max} onChange={(e) => setStart(e.target.value)} />
        </label>
        {fast?.endedAt && (
          <label className="nf-field">
            <span className="nf-label">Terminó</span>
            <input className="nf-date nf-date--lg" type="datetime-local" value={end} max={max} onChange={(e) => setEnd(e.target.value)} />
          </label>
        )}
      </div>
    </Modal>
  );
}
