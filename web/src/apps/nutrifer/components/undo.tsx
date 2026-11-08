import { message } from "antd";

let seq = 0;

/**
 * Aviso de «quedó anotado» con un botón para deshacer (lo de un toque se puede deshacer al instante).
 * `onUndo` hace el trabajo; el aviso se cierra al tocarlo.
 */
export function notifyUndo(text: string, onUndo: () => Promise<void> | void) {
  const key = `nf-undo-${++seq}`;
  message.open({
    key,
    type: "success",
    duration: 5,
    content: (
      <span className="nf-undo">
        {text}
        <button
          type="button"
          className="nf-undo__btn"
          onClick={() => {
            message.destroy(key);
            void onUndo();
          }}
        >
          Deshacer
        </button>
      </span>
    ),
  });
}
