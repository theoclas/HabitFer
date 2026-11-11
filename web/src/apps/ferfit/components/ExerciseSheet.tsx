import { Button, Drawer } from "antd";
import type { ReactNode } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { LEVEL_LABELS, doseText } from "../format";
import type { Exercise, Library } from "../types";
import { ExerciseFigure } from "./ExerciseFigure";

type Props = {
  exercise: Exercise | null;
  lib: Library;
  onClose: () => void;
  /** Pasar a otro ejercicio (la versión más fácil o más difícil). */
  onOpen: (key: string) => void;
  /** Botones extra al final (por ejemplo «Agregar a una rutina»). */
  actions?: ReactNode;
};

/** Cómo se hace un ejercicio: la figura grande, los pasos y un consejo. */
export function ExerciseSheet({ exercise, lib, onClose, onOpen, actions }: Props) {
  const isMobile = useIsMobile();
  const e = exercise;
  const byKey = (k?: string) => (k ? lib.exercises.find((x) => x.key === k) : undefined);
  const easier = byKey(e?.easier);
  const harder = byKey(e?.harder);

  return (
    <Drawer
      open={!!e}
      onClose={onClose}
      title={e?.name}
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "88dvh" : 480}
      rootClassName="fit-drawer"
      styles={{ body: { paddingBottom: isMobile ? "max(24px, env(safe-area-inset-bottom))" : 24, overflowX: "hidden" } }}
    >
      {e && (
        <div className="fit-sheet">
          <div className="fit-sheet__fig">
            <ExerciseFigure key={e.key} figure={e.figure} label={`Cómo se hace: ${e.name}`} />
          </div>
          <div className="fit-tags">
            <span className="fit-tag">{lib.labels.focus[e.focus] ?? e.focus}</span>
            <span className="fit-tag">{LEVEL_LABELS[e.level]}</span>
            <span className={e.impact === "bajo" ? "fit-tag fit-tag--low" : "fit-tag fit-tag--high"}>{e.impact === "bajo" ? "Bajo impacto" : "Con saltos"}</span>
            {e.equipment.length === 0 ? <span className="fit-tag">Sin equipo</span> : e.equipment.map((q) => <span key={q} className="fit-tag">{lib.labels.equipment[q] ?? q}</span>)}
          </div>
          <div className="fit-hint">
            Trabaja: {e.muscles.map((m) => (lib.labels.muscles[m] ?? m).toLowerCase()).join(", ")}. Sugerido: {doseText({ sets: 3, reps: e.reps, seconds: e.seconds }, e.perSide)}.
          </div>
          <ol className="fit-steps">
            {e.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {e.tip && <div className="fit-tip">{e.tip}</div>}
          {(easier || harder) && (
            <div className="fit-actions">
              {easier && <Button onClick={() => onOpen(easier.key)}>Más fácil: {easier.name}</Button>}
              {harder && <Button onClick={() => onOpen(harder.key)}>Más difícil: {harder.name}</Button>}
            </div>
          )}
          {actions}
        </div>
      )}
    </Drawer>
  );
}
