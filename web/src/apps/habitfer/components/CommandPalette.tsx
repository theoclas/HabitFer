import { SearchOutlined } from "@ant-design/icons";
import { Input, Modal, message, type InputRef } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createTask, fetchHabits, fetchProjects, fetchTasks, updateTask } from "../../../api/client";
import { habitEmoji, isMeasurable, isQuit } from "../../../features/habits/habitUtils";
import { parseQuickTask } from "../../../features/tasks/parseQuickTask";
import { dueLabel } from "../../../features/tasks/TaskCard";
import type { Habit, Project, Task } from "../../../types";
import { notifyHabitsChanged } from "../effects";
import { canFocus } from "../focus";
import { apiErrorMessage } from "../format";
import { setValueRemote, toggleHabitRemote } from "../offline";
import type { HfThemePref } from "../theme/useHfTheme";

export type PaletteActions = {
  onNewHabit: () => void;
  onPause: () => void;
  onNotifications: () => void;
  onBackup: () => void;
  onWrapped: () => void;
  onTheme: (p: HfThemePref) => void;
  onFocus: (habit: Habit) => void;
};

type Item = {
  key: string;
  group: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  /** Palabras extra para buscar. */
  keywords?: string;
  run: () => void | Promise<void>;
};

const ACCENTS: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n" };
function fold(s: string): string {
  return s.toLowerCase().replace(/[áéíóúüñ]/g, (c) => ACCENTS[c] ?? c);
}

const GO: { path: string; label: string; icon: string; keywords: string }[] = [
  { path: "/app/habitfer", label: "Hoy", icon: "🔥", keywords: "inicio dia" },
  { path: "/app/habitfer/habits", label: "Hábitos", icon: "🌱", keywords: "lista ordenar archivados" },
  { path: "/app/habitfer/tasks", label: "Tareas", icon: "☑️", keywords: "pendientes tablero" },
  { path: "/app/habitfer/stats", label: "Estadísticas", icon: "📊", keywords: "datos insights" },
  { path: "/app/habitfer/logros", label: "Logros", icon: "🏆", keywords: "medallas vitrina retos" },
];

type Props = PaletteActions & { open: boolean; onClose: () => void };

/** Paleta de comandos (Ctrl+K): ir a un habito, marcarlo, crear una tarea o abrir un ajuste. */
export function CommandPalette({ open, onClose, ...actions }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<InputRef>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    Promise.all([fetchHabits().catch(() => []), fetchTasks().catch(() => []), fetchProjects().catch(() => [])]).then(([h, t, p]) => {
      setHabits(h);
      setTasks(t.filter((x) => x.status !== "DONE"));
      setProjects(p);
    });
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  const go = (path: string) => {
    onClose();
    navigate(path, { viewTransition: true });
  };

  const markHabit = async (h: Habit) => {
    onClose();
    const today = dayjs().format("YYYY-MM-DD");
    try {
      if (isMeasurable(h)) {
        const value = h.valueToday + Math.max(1, h.step);
        const res = await setValueRemote(h.id, today, value);
        message.success(res.queued ? "Sin conexión: lo envío cuando vuelva la señal" : `${h.title}: ${value} de ${h.goal}${h.unit ? ` ${h.unit}` : ""}`);
      } else {
        const res = await toggleHabitRemote(h.id, today, !h.completedToday);
        message.success(res.queued ? "Sin conexión: lo envío cuando vuelva la señal" : h.completedToday ? `${h.title}: desmarcado` : `${h.title}: hecho 🔥`);
      }
      notifyHabitsChanged();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo marcar"));
    }
  };

  const items = useMemo<Item[]>(() => {
    const q = fold(query.trim());
    const out: Item[] = [];
    const matches = (text: string) => !q || fold(text).includes(q);
    const now = dayjs();
    const parsed = q ? parseQuickTask(query, { todayKey: now.format("YYYY-MM-DD"), minutes: now.hour() * 60 + now.minute() }, projects) : null;

    for (const h of habits) {
      if (!matches(`${h.title} ${h.description ?? ""}`)) continue;
      out.push({
        key: `habit-${h.id}`,
        group: "Hábitos",
        icon: habitEmoji(h.icon),
        label: h.title,
        hint: "abrir",
        run: () => go(`/app/habitfer/habits/${h.id}`),
      });
      if (q && h.scheduledToday && !isQuit(h)) {
        out.push({
          key: `mark-${h.id}`,
          group: "Hábitos",
          icon: "✓",
          label: isMeasurable(h) ? `Sumar ${h.step} a ${h.title}` : h.completedToday ? `Desmarcar ${h.title}` : `Marcar ${h.title} como hecho`,
          hint: isMeasurable(h) ? `${h.valueToday} de ${h.goal}` : "hoy",
          run: () => markHabit(h),
        });
      }
      if (q && h.scheduledToday && canFocus(h)) {
        out.push({ key: `focus-${h.id}`, group: "Hábitos", icon: "⏱️", label: `Enfoque: ${h.title}`, hint: "temporizador", run: () => { onClose(); actions.onFocus(h); } });
      }
    }

    for (const t of tasks) {
      if (!q || !matches(t.title)) continue;
      out.push({
        key: `task-${t.id}`,
        group: "Tareas",
        icon: "☑️",
        label: `Cerrar «${t.title}»`,
        hint: dueLabel(t) ?? "tarea",
        run: async () => {
          onClose();
          try {
            await updateTask(t.id, { status: "DONE" });
            message.success("Tarea hecha");
          } catch (err) {
            message.error(apiErrorMessage(err, "No se pudo cerrar la tarea"));
          }
        },
      });
    }

    if (parsed?.title) {
      const due = parsed.dueDate ? dueLabel({ dueDate: parsed.dueDate, dueTime: parsed.dueTime }) : null;
      const prio = parsed.priority === "HIGH" ? "prioridad alta" : parsed.priority === "LOW" ? "prioridad baja" : null;
      out.push({
        key: "new-task",
        group: "Crear",
        icon: "⚡",
        label: `Nueva tarea: ${parsed.title}`,
        hint: [due ?? "sin fecha", prio].filter(Boolean).join(" · "),
        run: async () => {
          onClose();
          try {
            await createTask({
              title: parsed.title,
              priority: parsed.priority,
              dueDate: parsed.dueDate,
              dueTime: parsed.dueTime,
              projectId: parsed.projectId,
              reminderEnabled: parsed.reminderEnabled,
            });
            message.success(due ? `Tarea para ${due}` : "Tarea creada");
          } catch (err) {
            message.error(apiErrorMessage(err, "No se pudo crear la tarea"));
          }
        },
      });
    }

    const commands: Item[] = [
      { key: "cmd-habit", group: "Acciones", icon: "➕", label: "Nuevo hábito", keywords: "crear plantilla", run: () => { onClose(); actions.onNewHabit(); } },
      { key: "cmd-wrapped", group: "Acciones", icon: "✨", label: "Tu mes en HabitFer", keywords: "resumen wrapped compartir", run: () => { onClose(); actions.onWrapped(); } },
      { key: "cmd-pause", group: "Acciones", icon: "🌴", label: "Pausar todo (vacaciones)", keywords: "viaje enfermo", run: () => { onClose(); actions.onPause(); } },
      { key: "cmd-notif", group: "Acciones", icon: "🔔", label: "Notificaciones", keywords: "avisos push recordatorio", run: () => { onClose(); actions.onNotifications(); } },
      { key: "cmd-backup", group: "Acciones", icon: "💾", label: "Respaldo de datos", keywords: "exportar importar csv json", run: () => { onClose(); actions.onBackup(); } },
      { key: "cmd-night", group: "Acciones", icon: "🌙", label: "Tema noche", keywords: "oscuro", run: () => { onClose(); actions.onTheme("night"); } },
      { key: "cmd-day", group: "Acciones", icon: "☀️", label: "Tema día", keywords: "claro", run: () => { onClose(); actions.onTheme("day"); } },
      ...GO.map((g) => ({ key: `go-${g.path}`, group: "Ir a", icon: g.icon, label: g.label, keywords: g.keywords, run: () => go(g.path) })),
    ];
    out.push(...commands.filter((c) => matches(`${c.label} ${c.keywords ?? ""}`)));
    return out.slice(0, 40);
  }, [query, habits, tasks, projects]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void items[index]?.run();
    }
  };

  let lastGroup = "";
  return (
    <Modal open={open} onCancel={onClose} footer={null} closable={false} width={560} className="hf-palette" style={{ top: "10vh" }} destroyOnHidden>
      <Input
        ref={inputRef}
        size="large"
        prefix={<SearchOutlined />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Busca un hábito, escribe una tarea o un comando"
        aria-label="Buscar"
        role="combobox"
        aria-expanded
        aria-controls="hf-palette-list"
        aria-activedescendant={items[index] ? `hf-cmd-${index}` : undefined}
      />
      <div className="hf-palette__list" id="hf-palette-list" role="listbox" ref={listRef}>
        {items.length === 0 && <p className="hf-palette__empty">Nada con «{query}».</p>}
        {items.map((item, i) => {
          const head = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <div key={item.key}>
              {head && <div className="hf-palette__group">{head}</div>}
              <button
                type="button"
                id={`hf-cmd-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === index}
                className={`hf-palette__item${i === index ? " is-active" : ""}`}
                onMouseMove={() => setIndex(i)}
                onClick={() => void item.run()}
              >
                <span className="hf-palette__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="hf-palette__label">{item.label}</span>
                {item.hint && <span className="hf-palette__hint">{item.hint}</span>}
              </button>
            </div>
          );
        })}
      </div>
      <div className="hf-palette__foot">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> moverse
        </span>
        <span>
          <kbd>Enter</kbd> elegir
        </span>
        <span>
          <kbd>Esc</kbd> cerrar
        </span>
      </div>
    </Modal>
  );
}
