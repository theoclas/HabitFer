import { CalendarOutlined, PlusOutlined, ToolOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRoutines } from "../api";
import { EquipmentModal } from "../components/EquipmentModal";
import { ExerciseFigure } from "../components/ExerciseFigure";
import { LEVEL_LABELS, minutesText } from "../format";
import { fitSettings, useLibrary } from "../hooks";
import { FF_BASE } from "../layouts/FerFitShell";
import { missingGear } from "../similar";
import type { Exercise, ReadyRoutine, Routine } from "../types";

/** Un ejercicio que se reconozca (el primero que no sea de calentar). */
function thumbOf(keys: string[], byKey: Map<string, Exercise>): Exercise | undefined {
  const list = keys.map((k) => byKey.get(k)).filter((e): e is Exercise => !!e);
  return list.find((e) => e.focus !== "cardio" || list.every((x) => x.focus === "cardio")) ?? list[0];
}

/** Mis rutinas y las rutinas listas, por enfoque y con lo que hay en casa. */
export function FitRoutinesPage() {
  const navigate = useNavigate();
  const { lib, byKey } = useLibrary();
  const settings = fitSettings.use();
  const has = settings?.equipment ?? null;
  const [mine, setMine] = useState<Routine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(true);
  const [gearOpen, setGearOpen] = useState(false);

  useEffect(() => {
    fetchRoutines()
      .then(setMine)
      .catch(() => setFailed(true));
  }, []);

  const labels = lib?.labels;
  const gearOf = (keys: string[]) =>
    missingGear(
      keys.map((k) => byKey.get(k)).filter((e): e is Exercise => !!e),
      has,
    );
  const gearText = (missing: string[]) => `Necesita: ${missing.map((q) => (labels?.equipment[q] ?? q).toLowerCase()).join(", ")}`;

  const ready = useMemo(() => {
    let list = lib?.ready ?? [];
    if (topic) list = list.filter((r) => r.topics?.includes(topic));
    if (onlyMine && has) list = list.filter((r) => gearOf(r.items.map((i) => i.key)).length === 0);
    return list;
    // gearOf depende de byKey y has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, topic, onlyMine, has, byKey]);

  const groups = useMemo(() => {
    if (topic) return [{ id: topic, title: labels?.topics?.[topic] ?? topic, items: ready }];
    const order = ["mixta", "fuerza", "cardio", "core", "movilidad", "estiramiento"];
    return order
      .map((focus) => ({ id: focus, title: focus === "mixta" ? "Para empezar" : (labels?.focus[focus] ?? focus), items: ready.filter((r) => r.focus === focus) }))
      .filter((g) => g.items.length > 0);
  }, [ready, topic, labels]);

  const readyCard = (r: ReadyRoutine) => {
    const ex = thumbOf(
      r.items.map((i) => i.key),
      byKey,
    );
    const missing = gearOf(r.items.map((i) => i.key));
    return (
      <button key={r.key} type="button" className="fit-rcard" onClick={() => navigate(`${FF_BASE}/listas/${r.key}`)}>
        <span className="fit-rcard__fig">{ex && <ExerciseFigure figure={ex.figure} label="" animate={false} />}</span>
        <span className="fit-rcard__body">
          <span className="fit-rcard__name">{r.name}</span>
          <span className="fit-rcard__summary">{r.summary}</span>
          <span className="fit-rcard__meta">
            {minutesText(r.minutes)} · {LEVEL_LABELS[r.level]}
            {r.circuit ? ` · circuito × ${r.rounds}` : ""}
          </span>
          {missing.length > 0 && <span className="fit-rcard__need">{gearText(missing)}</span>}
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="fit-pagehead">
        <div>
          <h1 className="fit-title">Rutinas</h1>
          <p className="fit-sub">Haz una lista tal cual, cópiala para cambiarla o arma la tuya.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`${FF_BASE}/rutinas/nueva`)}>
          Crear rutina
        </Button>
      </div>

      <section className="fit-section" aria-labelledby="fit-mine">
        <h2 className="fit-h2" id="fit-mine">
          Mis rutinas
        </h2>
        {failed && <div className="fit-empty">No se pudieron cargar tus rutinas.</div>}
        {!failed && mine === null && <div className="fit-empty">Cargando…</div>}
        {mine && mine.length === 0 && (
          <div className="fit-empty">
            Aún no tienes rutinas propias. Copia una de las listas o arma la tuya desde cero.
            <Button icon={<PlusOutlined />} onClick={() => navigate(`${FF_BASE}/rutinas/nueva`)}>
              Crear rutina
            </Button>
          </div>
        )}
        {mine && mine.length > 0 && (
          <div className="fit-grid fit-grid--3">
            {mine.map((r) => {
              const ex = thumbOf(
                r.items.map((i) => i.exerciseKey),
                byKey,
              );
              const missing = gearOf(r.items.map((i) => i.exerciseKey));
              return (
                <button key={r.id} type="button" className="fit-rcard" onClick={() => navigate(`${FF_BASE}/rutinas/${r.id}`)}>
                  <span className="fit-rcard__fig">{ex && <ExerciseFigure figure={ex.figure} label="" animate={false} />}</span>
                  <span className="fit-rcard__body">
                    <span className="fit-rcard__name">{r.name}</span>
                    <span className="fit-rcard__meta">
                      {minutesText(r.minutes)} · {r.items.length} ejercicios{r.circuit ? ` · circuito × ${r.rounds}` : ""}
                    </span>
                    {missing.length > 0 && <span className="fit-rcard__need">{gearText(missing)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {(lib?.programs?.length ?? 0) > 0 && (
        <button type="button" className="fit-card fit-programlink" onClick={() => navigate(`${FF_BASE}/semana`)}>
          <CalendarOutlined aria-hidden="true" />
          <span>
            <b>Programas de varias semanas</b>
            <small>{lib!.programs!.map((p) => p.name).join(" · ")}. Se ponen solos en tu semana.</small>
          </span>
        </button>
      )}

      {lib && (
        <section className="fit-section" aria-label="Rutinas listas por enfoque">
          <div className="fit-chips" role="group" aria-label="Enfoque" style={{ flexWrap: "wrap" }}>
            <button type="button" className="fit-chip" aria-pressed={topic === null} onClick={() => setTopic(null)}>
              Todas
            </button>
            {Object.entries(labels?.topics ?? {}).map(([k, label]) => (
              <button key={k} type="button" className="fit-chip" aria-pressed={topic === k} onClick={() => setTopic(topic === k ? null : k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="fit-chips" role="group" aria-label="Equipo">
            {has !== null && (
              <button type="button" className="fit-chip" aria-pressed={onlyMine} onClick={() => setOnlyMine((v) => !v)}>
                Solo lo que puedo hacer
              </button>
            )}
            <button type="button" className="fit-chip" onClick={() => setGearOpen(true)}>
              <ToolOutlined /> {has === null ? "¿Qué tienes en casa?" : "Mi equipo"}
            </button>
          </div>
        </section>
      )}

      {lib &&
        groups.map((g) => (
          <section key={g.id} className="fit-section" aria-labelledby={`fit-ready-${g.id}`}>
            <h2 className="fit-h2" id={`fit-ready-${g.id}`}>
              {g.title}
            </h2>
            {g.items.length ? (
              <div className="fit-grid fit-grid--3">{g.items.map(readyCard)}</div>
            ) : (
              <div className="fit-empty">No hay rutinas de este enfoque que puedas hacer con lo que tienes.</div>
            )}
          </section>
        ))}
      {lib && topic === null && groups.length === 0 && <div className="fit-empty">No hay rutinas que puedas hacer con lo que tienes.</div>}

      <EquipmentModal open={gearOpen} onClose={() => setGearOpen(false)} />
    </>
  );
}
