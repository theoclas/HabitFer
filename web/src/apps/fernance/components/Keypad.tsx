const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"];

/** Teclado de números grande para el teléfono (sin abrir el teclado del sistema). */
export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="ff-keypad" role="group" aria-label="Teclado de números">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className={`ff-key${k === "back" ? " ff-key--muted" : ""}`}
          onClick={() => onKey(k)}
          aria-label={k === "back" ? "Borrar el último número" : k}
        >
          {k === "back" ? "⌫" : k}
        </button>
      ))}
    </div>
  );
}
