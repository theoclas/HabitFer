import { Button, Drawer } from "antd";
import { useMemo, type ReactNode } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { LEVEL_LABELS, doseText } from "../format";
import { fitSettings } from "../hooks";
import { similarTo } from "../similar";
import type { Exercise, Library } from "../types";
import { ExerciseFigure } from "./ExerciseFigure";
import { VideoBlock } from "./VideoBlock";

type Props = {
  exercise: Exercise | null;
  lib: Library;
  onClose: () => void;
  /** Pasar a otro ejercicio (la versión más fácil o más difícil, o uno parecido). */
  onOpen: (key: string) => void;
  /** Botones extra al final (por ejemplo «Agregar a una rutina»). */
  actions?: ReactNode;
};

/** Cómo se hace un ejercicio: la figura, el video, los pasos, un consejo y otros parecidos. */
export function ExerciseSheet({ exercise, lib, onClose, onOpen, actions }: Props) {
  const isMobile = useIsMobile();
  const settings = fitSettings.use();
  const e = exercise;
  const byKey = (k?: string) => (k ? lib.exercises.find((x) => x.key === k) : undefined);
  const easier = byKey(e?.easier);
  const harder = byKey(e?.harder);
  const similar = useMemo(
    () => (e ? similarTo(e, lib.exercises, settings?.equipment ?? null, 6).filter((o) => o.key !== easier?.key && o.key !== harder?.key).slice(0, 4) : []),
    [e, lib, settings, easier, harder],
  );

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
          <VideoBlock key={e.key} target="exercise" targetKey={e.key} curated={lib.videos?.exercises[e.key] ?? null} what="este ejercicio" />
          {(easier || harder) && (
            <div className="fit-actions">
              {easier && <Button onClick={() => onOpen(easier.key)}>Más fácil: {easier.name}</Button>}
              {harder && <Button onClick={() => onOpen(harder.key)}>Más difícil: {harder.name}</Button>}
            </div>
          )}
          {similar.length > 0 && (
            <div className="fit-field">
              <span className="fit-label">Parecidos</span>
              <div className="fit-chips" style={{ flexWrap: "wrap" }}>
                {similar.map((o) => (
                  <button key={o.key} type="button" className="fit-chip" onClick={() => onOpen(o.key)}>
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {actions}
        </div>
      )}
    </Drawer>
  );
}
