import { PlusOutlined } from "@ant-design/icons";
import { Button, Select, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchRoutines, updateRoutine } from "../api";
import { ExerciseFigure } from "../components/ExerciseFigure";
import { ExerciseFilters, NO_FILTERS, filterExercises, type Filters } from "../components/ExerciseFilters";
import { ExerciseSheet } from "../components/ExerciseSheet";
import { LEVEL_LABELS } from "../format";
import { useLibrary } from "../hooks";
import { FF_BASE } from "../layouts/FerFitShell";
import type { Exercise, Routine } from "../types";

/** La biblioteca: buscar, filtrar, ver cómo se hace cada ejercicio y agregarlo a una rutina. */
export function FitExercisesPage() {
  const { lib, error } = useLibrary();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [openKey, setOpenKey] = useState<string | null>(params.get("ver"));
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [target, setTarget] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  // Revisión de las figuras en desarrollo: ?figuras muestra la pose A y la B de cada ejercicio, quietas.
  const debug = import.meta.env.DEV && params.has("figuras");

  useEffect(() => {
    fetchRoutines()
      .then(setRoutines)
      .catch(() => setRoutines([]));
  }, []);

  const list = useMemo(() => (lib ? filterExercises(lib.exercises, filters, lib) : []), [lib, filters]);
  const open = lib?.exercises.find((e) => e.key === openKey) ?? null;

  const addTo = async (ex: Exercise) => {
    const r = routines?.find((x) => x.id === target);
    if (!r) return;
    setAdding(true);
    try {
      const items = [
        ...r.items.map(({ exerciseKey, sets, reps, seconds, restSeconds }) => ({ exerciseKey, sets, reps, seconds, restSeconds })),
        { exerciseKey: ex.key, sets: r.circuit ? 1 : 3, reps: ex.seconds ? null : (ex.reps ?? 10), seconds: ex.seconds ?? null, restSeconds: r.circuit ? 20 : 45 },
      ];
      const saved = await updateRoutine(r.id, { name: r.name, notes: r.notes, circuit: r.circuit, rounds: r.rounds, items });
      setRoutines((all) => (all ?? []).map((x) => (x.id === saved.id ? saved : x)));
      message.success(`Agregado a «${saved.name}»`);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo agregar"));
    } finally {
      setAdding(false);
    }
  };

  if (!lib) return <div className="fit-empty">{error ? "No se pudo cargar la biblioteca. Revisa la conexión." : "Cargando ejercicios…"}</div>;

  if (debug) {
    // Las dos poses una encima de la otra: A en el color del texto, B en azul.
    return (
      <div className="fit-debug">
        {lib.exercises.map((e) => (
          <div key={e.key} className="fit-debug__item">
            <svg viewBox="0 0 120 120" className="fit-fig" role="img" aria-label={e.name}>
              {e.figure.props.map((d, i) => (
                <path key={`p${i}`} d={d} className={i === 0 ? "fit-fig__floor" : "fit-fig__prop"} />
              ))}
              {[e.figure.a, e.figure.b].map((s, k) =>
                s ? (
                  <g key={k} style={{ color: k === 0 ? "var(--fit-ink)" : "var(--fit-accent)", opacity: k === 0 ? 1 : 0.75 }}>
                    {s.lines.map((l, i) => (
                      <path key={i} d={l.d} className={l.far ? "fit-fig__limb fit-fig__limb--far" : "fit-fig__limb"} style={{ strokeWidth: 4 }} />
                    ))}
                    <circle cx={s.head[0]} cy={s.head[1]} r={7.5} className="fit-fig__head" />
                  </g>
                ) : null,
              )}
            </svg>
            <span className="fit-debug__name">{e.key}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="fit-pagehead">
        <div>
          <h1 className="fit-title">Ejercicios</h1>
          <p className="fit-sub">
            {lib.exercises.length} ejercicios para la casa. Toca uno para ver cómo se hace.
          </p>
        </div>
      </div>
      <ExerciseFilters lib={lib} value={filters} onChange={setFilters} idPrefix="fit-lib" />
      {list.length === 0 ? (
        <div className="fit-empty">
          Nada con esos filtros.
          <Button onClick={() => setFilters(NO_FILTERS)}>Quitar los filtros</Button>
        </div>
      ) : (
        <div className="fit-exgrid">
          {list.map((e) => (
            <button key={e.key} type="button" className="fit-excard" onClick={() => setOpenKey(e.key)}>
              <span className="fit-excard__fig">
                <ExerciseFigure figure={e.figure} label="" />
              </span>
              <span className="fit-excard__name">{e.name}</span>
              <span className="fit-excard__meta">
                {LEVEL_LABELS[e.level]} · {e.equipment.length ? e.equipment.map((q) => lib.labels.equipment[q]).join(", ") : "sin equipo"}
              </span>
            </button>
          ))}
        </div>
      )}

      <ExerciseSheet
        exercise={open}
        lib={lib}
        onClose={() => setOpenKey(null)}
        onOpen={setOpenKey}
        actions={
          open && (
            <div className="fit-card" style={{ padding: 12 }}>
              <span className="fit-label">Agregar a una rutina</span>
              {routines && routines.length > 0 ? (
                <div className="fit-actions">
                  <Select
                    aria-label="Rutina"
                    placeholder="Escoge una rutina"
                    value={target}
                    onChange={setTarget}
                    options={routines.map((r) => ({ value: r.id, label: r.name }))}
                    style={{ minWidth: 200, flex: 1 }}
                  />
                  <Button type="primary" icon={<PlusOutlined />} disabled={!target} loading={adding} onClick={() => void addTo(open)}>
                    Agregar
                  </Button>
                </div>
              ) : (
                <div className="fit-actions">
                  <span className="fit-hint">Aún no tienes rutinas propias.</span>
                  <Button onClick={() => navigate(`${FF_BASE}/rutinas/nueva?con=${open.key}`)}>Crear una con este</Button>
                </div>
              )}
            </div>
          )
        }
      />
    </>
  );
}
