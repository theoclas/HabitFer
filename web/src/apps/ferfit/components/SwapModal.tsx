import { Modal } from "antd";
import { useMemo } from "react";
import { LEVEL_LABELS } from "../format";
import { similarTo } from "../similar";
import type { Exercise, Library } from "../types";
import { ExerciseFigure } from "./ExerciseFigure";

type Props = {
  exercise: Exercise | null;
  lib: Library;
  /** Lo que hay en casa (null: no lo ha dicho). */
  has: string[] | null;
  busy?: boolean;
  /** Algo más que decir (por ejemplo, que se guarda una copia). */
  note?: string;
  onClose: () => void;
  onPick: (ex: Exercise) => void;
};

/** Cambiar un ejercicio por otro que trabaja lo mismo (si algo duele o no se tiene el equipo). */
export function SwapModal({ exercise, lib, has, busy, note, onClose, onPick }: Props) {
  const options = useMemo(() => (exercise ? similarTo(exercise, lib.exercises, has, 8) : []), [exercise, lib, has]);
  const tag = (o: Exercise) =>
    o.key === exercise?.easier || o.harder === exercise?.key ? "más fácil" : o.key === exercise?.harder || o.easier === exercise?.key ? "más difícil" : "";
  return (
    <Modal open={!!exercise} title={exercise ? `Cambiar «${exercise.name}»` : ""} footer={null} onCancel={onClose}>
      <div className="fit-sheet">
        <span className="fit-hint">
          Ejercicios que trabajan lo mismo{has ? " y puedes hacer con lo que tienes en casa" : ""}. Si algo te duele, escoge uno más fácil.
        </span>
        {note && <span className="fit-hint">{note}</span>}
        {options.length === 0 ? (
          <div className="fit-empty">No encontré uno parecido.</div>
        ) : (
          <ul className="fit-swaplist">
            {options.map((o) => (
              <li key={o.key}>
                <button type="button" className="fit-swap" disabled={busy} onClick={() => onPick(o)}>
                  <span className="fit-swap__fig">
                    <ExerciseFigure figure={o.figure} label="" animate={false} />
                  </span>
                  <span className="fit-swap__body">
                    <b>{o.name}</b>
                    <small>
                      {[
                        tag(o),
                        LEVEL_LABELS[o.level],
                        o.muscles
                          .slice(0, 3)
                          .map((m) => (lib.labels.muscles[m] ?? m).toLowerCase())
                          .join(", "),
                        o.equipment.length ? o.equipment.map((q) => (lib.labels.equipment[q] ?? q).toLowerCase()).join(", ") : "sin equipo",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
