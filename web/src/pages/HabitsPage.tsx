import { DeleteOutlined, DownOutlined, PlusOutlined, RollbackOutlined, SwapOutlined, UpOutlined } from "@ant-design/icons";
import { Button, Modal, message } from "antd";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { deleteHabit, fetchArchivedHabits, fetchHabits, reorderHabits, updateHabit } from "../api/client";
import { HABITS_CHANGED_EVENT, notifyHabitsChanged } from "../apps/habitfer/effects";
import { apiErrorMessage } from "../apps/habitfer/format";
import { HabitEditorDrawer } from "../components/HabitEditorDrawer";
import { CollapsibleHabitSection } from "../features/habits/CollapsibleHabitSection";
import { habitEmoji, habitScheduleLabel } from "../features/habits/habitUtils";
import { SortableHabitList } from "../features/habits/SortableHabitList";
import { useCelebrateLoaded, useHabitActions } from "../features/habits/useHabitActions";
import { useIsMobile } from "../hooks/useIsMobile";
import type { Habit } from "../types";
import { todayKey } from "../utils/dates";

export function HabitsPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const celebrateLoaded = useCelebrateLoaded();
  const [habits, setHabits] = useState<Habit[]>([]);
  const habitsRef = useRef<Habit[]>([]);
  habitsRef.current = habits;
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [sorting, setSorting] = useState<Habit[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [archived, setArchived] = useState<Habit[] | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const list = await fetchHabits();
        habitsRef.current = list;
        setHabits(list);
        celebrateLoaded(list);
      } catch {
        if (!opts?.silent) message.error("No se pudieron cargar los habitos");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [celebrateLoaded],
  );

  const loadArchived = useCallback(async () => {
    try {
      setArchived(await fetchArchivedHabits());
    } catch {
      message.error("No se pudieron cargar los archivados");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChanged = () => {
      void load({ silent: true });
      if (archivedOpen) void loadArchived();
    };
    window.addEventListener(HABITS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(HABITS_CHANGED_EVENT, onChanged);
  }, [load, loadArchived, archivedOpen]);

  const actions = useHabitActions<Habit>({
    itemsRef: habitsRef,
    setItems: setHabits,
    dateKey: todayKey(),
    canMark: true,
    onSettled: () => void load({ silent: true }),
  });

  const cardLayout = isMobile ? "list" : "grid";

  const press = (habit: Habit) => {
    if (!habit.scheduledToday) {
      message.info("Este habito no esta programado para hoy");
      return;
    }
    actions.press(habit);
  };

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (habit: Habit) => {
    setEditing(habit);
    setEditorOpen(true);
  };

  const openDetail = (habit: Habit) => {
    navigate(`/app/habitfer/habits/${habit.id}`, { viewTransition: true, state: { habit } });
  };

  const saveOrder = async () => {
    if (!sorting) return;
    setSavingOrder(true);
    try {
      await reorderHabits(sorting.map((h) => h.id));
      habitsRef.current = sorting;
      setHabits(sorting);
      setSorting(null);
      message.success("Orden guardado");
      notifyHabitsChanged();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar el orden"));
    } finally {
      setSavingOrder(false);
    }
  };

  const toggleArchived = () => {
    const next = !archivedOpen;
    setArchivedOpen(next);
    if (next) void loadArchived();
  };

  const restore = async (habit: Habit) => {
    try {
      await updateHabit(habit.id, { archived: false });
      message.success(`${habit.title} vuelve a tus hábitos`);
      await Promise.all([load({ silent: true }), loadArchived()]);
      notifyHabitsChanged();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo restaurar"));
    }
  };

  const removeForever = (habit: Habit) => {
    Modal.confirm({
      title: `¿Eliminar «${habit.title}» para siempre?`,
      content: "Se borra con todo su historial, notas y medallas. No se puede deshacer.",
      okText: "Eliminar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteHabit(habit.id);
          message.success("Hábito eliminado");
          await loadArchived();
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo eliminar"));
        }
      },
    });
  };

  const scheduled = habits.filter((h) => h.scheduledToday);

  return (
    <div>
      <div className="hf-page-head">
        <div>
          <div className="hf-kicker">
            {habits.length} activos · {scheduled.length} hoy
          </div>
          <h1 className="hf-title hf-title--sm">{sorting ? "Ordena tus hábitos" : "Todos tus hábitos"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {sorting ? (
            null
          ) : (
            <>
              {habits.length > 1 && (
                <Button icon={<SwapOutlined rotate={90} />} onClick={() => setSorting(habits)}>
                  Ordenar
                </Button>
              )}
              {!isMobile && (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Nuevo
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {sorting ? (
        <>
          <div className="hf-sort-bar">
            <p className="hf-hint">Arrastra desde el agarre. Este orden se usa en Hoy y en tus listas.</p>
            <div className="hf-sort-bar__actions">
              <Button onClick={() => setSorting(null)}>Cancelar</Button>
              <Button type="primary" loading={savingOrder} onClick={() => void saveOrder()}>
                Guardar orden
              </Button>
            </div>
          </div>
          <SortableHabitList items={sorting} onChange={setSorting} />
        </>
      ) : loading ? (
        <div className="hf-list" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="hf-skel hf-skel--card" />
          ))}
        </div>
      ) : habits.length === 0 ? (
        <div className="hf-empty">
          <b>Todavía no tienes hábitos</b>
          <p style={{ margin: "0 0 16px" }}>Crea el primero con el botón +, o arranca con una plantilla.</p>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Crear hábito
          </Button>
        </div>
      ) : (
        <>
          <CollapsibleHabitSection
            id="hoy"
            title={`Hoy (${scheduled.length})`}
            habits={scheduled}
            layout={cardLayout}
            onToggle={press}
            onOpen={openDetail}
            onEdit={openEdit}
            onRelapse={actions.relapse}
          />
          <CollapsibleHabitSection
            id="todos"
            title={`Todos (${habits.length})`}
            habits={habits}
            layout={cardLayout}
            onToggle={press}
            onOpen={openDetail}
            onEdit={openEdit}
            onRelapse={actions.relapse}
          />
        </>
      )}

      {!sorting && !loading && (
        <section className="hf-archived">
          <button type="button" className="hf-archived__head" onClick={toggleArchived} aria-expanded={archivedOpen}>
            <span>Archivados{archived ? ` (${archived.length})` : ""}</span>
            {archivedOpen ? <UpOutlined style={{ fontSize: 12 }} /> : <DownOutlined style={{ fontSize: 12 }} />}
          </button>
          {archivedOpen &&
            (archived === null ? (
              <div className="hf-skel" style={{ height: 56 }} />
            ) : archived.length === 0 ? (
              <p className="hf-hint" style={{ marginTop: 0 }}>
                No tienes hábitos archivados. Archivar uno lo saca de tus listas sin borrar su historial.
              </p>
            ) : (
              <ul className="hf-archived__list">
                {archived.map((h) => (
                  <li key={h.id} className="hf-archived__row" style={{ "--c": h.color } as CSSProperties}>
                    <span className="hf-card__emoji" aria-hidden="true">
                      {habitEmoji(h.icon)}
                    </span>
                    <span className="hf-sort-row__text">
                      <b>{h.title}</b>
                      <small>
                        {habitScheduleLabel(h)}
                        {h.longestStreak > 0 ? ` · mejor racha ${h.longestStreak}` : ""}
                      </small>
                    </span>
                    <Button size="small" icon={<RollbackOutlined />} onClick={() => void restore(h)}>
                      Restaurar
                    </Button>
                    <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Eliminar ${h.title}`} onClick={() => removeForever(h)} />
                  </li>
                ))}
              </ul>
            ))}
        </section>
      )}

      <HabitEditorDrawer open={editorOpen} habit={editing} onClose={() => setEditorOpen(false)} onSaved={() => void load()} />
    </div>
  );
}
