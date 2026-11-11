import { CloseOutlined, HolderOutlined, PlusOutlined } from "@ant-design/icons";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Drawer, Input, InputNumber, Segmented, Select, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { apiErrorMessage } from "../../habitfer/format";
import { createRoutine, fetchRoutine, updateRoutine } from "../api";
import { ExerciseFigure } from "../components/ExerciseFigure";
import { ExerciseFilters, NO_FILTERS, filterExercises, type Filters } from "../components/ExerciseFilters";
import { minutesText } from "../format";
import { useLibrary } from "../hooks";
import { FF_BASE } from "../layouts/FerFitShell";
import type { Exercise, Library } from "../types";

type Row = { uid: string; exerciseKey: string; sets: number; mode: "reps" | "time"; reps: number; seconds: number; restSeconds: number };

const REST_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 75, 90, 120, 180].map((s) => ({ value: s, label: s === 0 ? "Sin descanso" : s < 60 ? `${s} s` : `${s / 60} min` }));
let uidSeq = 0;
const uid = () => `r${Date.now().toString(36)}${(uidSeq++).toString(36)}`;

function rowFor(ex: Exercise, circuit: boolean): Row {
  return {
    uid: uid(),
    exerciseKey: ex.key,
    sets: circuit ? 1 : 3,
    mode: ex.seconds ? "time" : "reps",
    reps: ex.reps ?? 10,
    seconds: ex.seconds ?? 30,
    restSeconds: circuit ? 20 : 45,
  };
}

/** Minutos aproximados (igual que la API): repetición ≈ 3 s, por lado cuenta doble. */
function estimate(rows: Row[], circuit: boolean, rounds: number, byKey: Map<string, Exercise>): number {
  if (!rows.length) return 0;
  const work = (r: Row) => (r.mode === "time" ? r.seconds : r.reps * 3) * (byKey.get(r.exerciseKey)?.perSide ? 2 : 1);
  const total = circuit
    ? rows.reduce((s, r) => s + work(r) + r.restSeconds, 0) * rounds
    : rows.reduce((s, r) => s + r.sets * work(r) + Math.max(0, r.sets - 1) * r.restSeconds + 20, 0);
  return Math.max(1, Math.round(total / 60));
}

/** Crear o editar una rutina propia. */
export function FitEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { lib, byKey } = useLibrary();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [circuit, setCircuit] = useState(false);
  const [rounds, setRounds] = useState(3);
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(!id);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchRoutine(id)
      .then((r) => {
        setName(r.name);
        setNotes(r.notes ?? "");
        setCircuit(r.circuit);
        setRounds(r.rounds);
        setRows(
          r.items.map((i) => ({
            uid: uid(),
            exerciseKey: i.exerciseKey,
            sets: i.sets,
            mode: i.seconds != null ? "time" : "reps",
            reps: i.reps ?? 10,
            seconds: i.seconds ?? 30,
            restSeconds: i.restSeconds,
          })),
        );
        setLoaded(true);
      })
      .catch(() => {
        message.error("Esa rutina ya no existe.");
        navigate(`${FF_BASE}/rutinas`);
      });
  }, [id, navigate]);

  // «Crear una con este» desde la biblioteca.
  useEffect(() => {
    const first = params.get("con");
    const ex = first ? byKey.get(first) : undefined;
    if (!id && ex) setRows((cur) => (cur.length ? cur : [rowFor(ex, false)]));
  }, [params, byKey, id]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setRows((cur) => {
      const from = cur.findIndex((r) => r.uid === active.id);
      const to = cur.findIndex((r) => r.uid === over.id);
      return from < 0 || to < 0 ? cur : arrayMove(cur, from, to);
    });
  };

  const patch = (u: string, p: Partial<Row>) => setRows((cur) => cur.map((r) => (r.uid === u ? { ...r, ...p } : r)));
  const minutes = estimate(rows, circuit, rounds, byKey);

  const save = async () => {
    if (!name.trim()) {
      message.warning("Ponle un nombre a la rutina.");
      return;
    }
    if (!rows.length) {
      message.warning("Agrega al menos un ejercicio.");
      return;
    }
    setSaving(true);
    const input = {
      name: name.trim(),
      notes: notes.trim() || null,
      circuit,
      rounds: circuit ? rounds : 1,
      items: rows.map((r) => ({
        exerciseKey: r.exerciseKey,
        sets: circuit ? 1 : r.sets,
        reps: r.mode === "reps" ? r.reps : null,
        seconds: r.mode === "time" ? r.seconds : null,
        restSeconds: r.restSeconds,
      })),
    };
    try {
      const saved = id ? await updateRoutine(id, input) : await createRoutine(input);
      message.success(id ? "Cambios guardados" : "Rutina creada");
      navigate(`${FF_BASE}/rutinas/${saved.id}`, { replace: true });
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  };

  if (!lib || !loaded) return <div className="fit-empty">Cargando…</div>;

  return (
    <div className="fit-editor">
      <div className="fit-pagehead">
        <div>
          <div className="fit-eyebrow">{id ? "Editar rutina" : "Rutina nueva"}</div>
          <h1 className="fit-title">{name.trim() || "Mi rutina"}</h1>
          <p className="fit-sub">
            {rows.length} ejercicios · unos {minutesText(minutes)}
          </p>
        </div>
      </div>

      <div className="fit-card">
        <div className="fit-field">
          <label className="fit-label" htmlFor="fit-r-name">
            Nombre
          </label>
          <Input id="fit-r-name" maxLength={80} placeholder="Por ejemplo: Piernas del lunes" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="fit-field">
          <label className="fit-label" htmlFor="fit-r-notes">
            Nota (opcional)
          </label>
          <Input.TextArea id="fit-r-notes" maxLength={500} autoSize={{ minRows: 1, maxRows: 4 }} placeholder="Para qué es o cómo hacerla" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="fit-field">
          <span className="fit-label" id="fit-r-kind">
            Cómo se hace
          </span>
          <Segmented
            aria-labelledby="fit-r-kind"
            value={circuit ? "circuito" : "series"}
            onChange={(v) => {
              const c = v === "circuito";
              setCircuit(c);
              setRows((cur) => cur.map((r) => ({ ...r, restSeconds: c ? Math.min(r.restSeconds, 30) : Math.max(r.restSeconds, 30) })));
            }}
            options={[
              { value: "series", label: "Por series" },
              { value: "circuito", label: "Circuito" },
            ]}
          />
          <span className="fit-hint">
            {circuit ? "Una vez cada ejercicio, seguidos, y se repite la vuelta." : "Todas las series de un ejercicio y luego el siguiente."}
          </span>
        </div>
        {circuit && (
          <div className="fit-field">
            <label className="fit-label" htmlFor="fit-r-rounds">
              Vueltas
            </label>
            <InputNumber id="fit-r-rounds" min={1} max={10} value={rounds} onChange={(v) => setRounds(typeof v === "number" ? v : 1)} style={{ width: 110 }} />
          </div>
        )}
      </div>

      <section className="fit-section" aria-labelledby="fit-r-items">
        <div className="fit-section__head">
          <h2 className="fit-h2" id="fit-r-items">
            Ejercicios
          </h2>
          <Button icon={<PlusOutlined />} onClick={() => setPickerOpen(true)}>
            Agregar ejercicios
          </Button>
        </div>
        {rows.length === 0 ? (
          <div className="fit-empty">
            Aún no tiene ejercicios.
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setPickerOpen(true)}>
              Agregar ejercicios
            </Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
              <ul className="fit-exlist">
                {rows.map((r) => (
                  <EditorRow key={r.uid} row={r} ex={byKey.get(r.exerciseKey)} circuit={circuit} onPatch={(p) => patch(r.uid, p)} onRemove={() => setRows((cur) => cur.filter((x) => x.uid !== r.uid))} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <div className="fit-actions fit-actions--end fit-sticky-actions">
        <Button onClick={() => navigate(id ? `${FF_BASE}/rutinas/${id}` : `${FF_BASE}/rutinas`)}>Cancelar</Button>
        <Button type="primary" loading={saving} onClick={() => void save()}>
          {id ? "Guardar cambios" : "Crear rutina"}
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        lib={lib}
        onClose={() => setPickerOpen(false)}
        onAdd={(keys) => {
          setRows((cur) => [...cur, ...keys.flatMap((k) => (byKey.get(k) ? [rowFor(byKey.get(k)!, circuit)] : []))]);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function EditorRow({ row, ex, circuit, onPatch, onRemove }: { row: Row; ex?: Exercise; circuit: boolean; onPatch: (p: Partial<Row>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.uid });
  const name = ex?.name ?? "Ejercicio que ya no existe";
  return (
    <li ref={setNodeRef} className={`fit-erow${isDragging ? " is-dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button type="button" className="fit-erow__handle" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Mover ${name}`}>
        <HolderOutlined />
      </button>
      <span className="fit-erow__fig">{ex && <ExerciseFigure figure={ex.figure} label="" animate={false} />}</span>
      <div className="fit-erow__body">
        <span className="fit-erow__name">
          {name}
          {ex?.perSide ? <span className="fit-unit"> · por lado</span> : null}
        </span>
        <div className="fit-erow__ctrls">
          {!circuit && (
            <>
              <InputNumber aria-label={`Series de ${name}`} size="small" min={1} max={10} value={row.sets} onChange={(v) => onPatch({ sets: typeof v === "number" ? v : 1 })} suffix="series" />
            </>
          )}
          <Segmented
            size="small"
            aria-label={`Por repeticiones o por tiempo: ${name}`}
            value={row.mode}
            onChange={(v) => onPatch({ mode: v as Row["mode"] })}
            options={[
              { value: "reps", label: "Rep." },
              { value: "time", label: "Seg." },
            ]}
          />
          {row.mode === "reps" ? (
            <InputNumber aria-label={`Repeticiones de ${name}`} size="small" min={1} max={200} value={row.reps} onChange={(v) => onPatch({ reps: typeof v === "number" ? v : 1 })} suffix="rep." />
          ) : (
            <InputNumber aria-label={`Segundos de ${name}`} size="small" min={5} max={900} step={5} value={row.seconds} onChange={(v) => onPatch({ seconds: typeof v === "number" ? v : 30 })} suffix="s" />
          )}
          <Select aria-label={`Descanso después de ${name}`} size="small" value={row.restSeconds} options={REST_OPTIONS} onChange={(v) => onPatch({ restSeconds: v })} />
        </div>
      </div>
      <button type="button" className="fit-icon-btn fit-icon-btn--sm" aria-label={`Quitar ${name}`} onClick={onRemove}>
        <CloseOutlined />
      </button>
    </li>
  );
}

/** Escoger ejercicios de la biblioteca (varios a la vez). */
function ExercisePicker({ open, lib, onClose, onAdd }: { open: boolean; lib: Library; onClose: () => void; onAdd: (keys: string[]) => void }) {
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);

  const list = useMemo(() => filterExercises(lib.exercises, filters, lib), [lib, filters]);
  const toggle = (k: string) => setPicked((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Agregar ejercicios"
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "92dvh" : 640}
      rootClassName="fit-drawer"
      styles={{ body: { paddingBottom: 16, overflowX: "hidden" } }}
      footer={
        <div className="fit-actions fit-actions--end">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" disabled={!picked.length} onClick={() => onAdd(picked)}>
            {picked.length ? `Agregar ${picked.length}` : "Escoge ejercicios"}
          </Button>
        </div>
      }
    >
      <div className="fit-sheet">
        <ExerciseFilters lib={lib} value={filters} onChange={setFilters} idPrefix="fit-pick" />
        <div className="fit-exgrid fit-exgrid--picker">
          {list.map((e) => {
            const n = picked.indexOf(e.key);
            return (
              <button key={e.key} type="button" className={`fit-excard${n >= 0 ? " is-picked" : ""}`} aria-pressed={n >= 0} onClick={() => toggle(e.key)}>
                <span className="fit-excard__fig">
                  <ExerciseFigure figure={e.figure} label="" animate={false} />
                  {n >= 0 && <span className="fit-excard__badge">{n + 1}</span>}
                </span>
                <span className="fit-excard__name">{e.name}</span>
              </button>
            );
          })}
        </div>
        {list.length === 0 && <div className="fit-empty">Nada con esos filtros.</div>}
      </div>
    </Drawer>
  );
}
