import { PlusOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRoutines } from "../api";
import { ExerciseFigure } from "../components/ExerciseFigure";
import { LEVEL_LABELS, minutesText } from "../format";
import { useLibrary } from "../hooks";
import { FF_BASE } from "../layouts/FerFitShell";
import type { Exercise, Routine } from "../types";

/** Un ejercicio que se reconozca (el primero que no sea de calentar). */
function thumbOf(keys: string[], byKey: Map<string, Exercise>): Exercise | undefined {
  const list = keys.map((k) => byKey.get(k)).filter((e): e is Exercise => !!e);
  return list.find((e) => e.focus !== "cardio" || list.every((x) => x.focus === "cardio")) ?? list[0];
}

/** Mis rutinas y las rutinas listas. */
export function FitRoutinesPage() {
  const navigate = useNavigate();
  const { lib, byKey } = useLibrary();
  const [mine, setMine] = useState<Routine[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchRoutines()
      .then(setMine)
      .catch(() => setFailed(true));
  }, []);

  const groups = useMemo(() => {
    const order = ["mixta", "fuerza", "cardio", "core", "movilidad", "estiramiento"];
    return order
      .map((focus) => ({ focus, items: (lib?.ready ?? []).filter((r) => r.focus === focus) }))
      .filter((g) => g.items.length > 0);
  }, [lib]);

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
              const ex = thumbOf(r.items.map((i) => i.exerciseKey), byKey);
              return (
                <button key={r.id} type="button" className="fit-rcard" onClick={() => navigate(`${FF_BASE}/rutinas/${r.id}`)}>
                  <span className="fit-rcard__fig">{ex && <ExerciseFigure figure={ex.figure} label="" animate={false} />}</span>
                  <span className="fit-rcard__body">
                    <span className="fit-rcard__name">{r.name}</span>
                    <span className="fit-rcard__meta">
                      {minutesText(r.minutes)} · {r.items.length} ejercicios{r.circuit ? ` · circuito × ${r.rounds}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {lib &&
        groups.map((g) => (
          <section key={g.focus} className="fit-section" aria-labelledby={`fit-ready-${g.focus}`}>
            <h2 className="fit-h2" id={`fit-ready-${g.focus}`}>
              {g.focus === "mixta" ? "Para empezar" : (lib.labels.focus[g.focus] ?? g.focus)}
            </h2>
            <div className="fit-grid fit-grid--3">
              {g.items.map((r) => {
                const ex = thumbOf(r.items.map((i) => i.key), byKey);
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
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
    </>
  );
}
