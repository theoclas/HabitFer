import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { createPortal } from "react-dom";
import { AppGlyph } from "./AppGlyph";
import { ACTIVE_APP_IDS, APPS, type AppId } from "./apps";
import { verticalStep, wideFirst } from "./launcherGrid";

const IDS = ACTIVE_APP_IDS;
/** Con un número impar de apps, la primera tarjeta va a lo ancho (ver launcherGrid.ts). */
const WIDE_FIRST = wideFirst(IDS.length);
/** En pantallas angostas el lanzador sale desde abajo, como una hoja. */
const SHEET_QUERY = "(max-width: 640px)";

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Espera a que termine la animación (con «reducir movimiento» solo dura el fundido). */
function after(ms: number, fn: () => void) {
  window.setTimeout(fn, prefersReducedMotion() ? Math.min(ms, 170) : ms);
}

type Props = {
  current: AppId;
  anchor: HTMLElement | null;
  /** Cerrar; `restoreFocus` devuelve el foco al botón que lo abrió. */
  onClose: (restoreFocus: boolean) => void;
  onLaunch: (id: AppId) => void;
};

type Phase = "open" | "closing" | "launching";

/**
 * Lanzador de apps: una tarjeta por app con su ícono, un brillo que sigue el puntero y un «despegue» al
 * elegir. Teclado: flechas, Tab, 1–N y Esc. Toma el modo claro u oscuro de la app abierta.
 */
export function AppLauncher({ current, anchor, onClose, onLaunch }: Props) {
  const titleId = useId();
  const [sheet] = useState(() => window.matchMedia?.(SHEET_QUERY).matches ?? false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [phase, setPhase] = useState<Phase>("open");
  const [launching, setLaunching] = useState<AppId | null>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);

  // En el computador queda pegado debajo del botón.
  useLayoutEffect(() => {
    if (sheet || !anchor) return undefined;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      // clientWidth no cuenta la barra de desplazamiento (en Windows corre el panel 15 px).
      const width = document.documentElement.clientWidth;
      setPos({ top: Math.round(r.bottom + 10), right: Math.max(12, Math.round(width - r.right)) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor, sheet]);

  // El foco arranca en la app abierta.
  useEffect(() => {
    tiles.current[IDS.indexOf(current)]?.focus({ preventScroll: true });
  }, [current]);

  // En el celular, la página de atrás no se mueve mientras la hoja está abierta.
  useEffect(() => {
    if (!sheet) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  const close = useCallback(() => {
    if (phase !== "open") return;
    setPhase("closing");
    after(sheet ? 220 : 140, () => onClose(true));
  }, [phase, sheet, onClose]);

  const launch = (id: AppId) => {
    if (phase !== "open") return;
    if (id === current) {
      close();
      return;
    }
    setLaunching(id);
    setPhase("launching");
    after(280, () => {
      onLaunch(id);
      onClose(false);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= IDS.length) {
      e.preventDefault();
      launch(IDS[n - 1]);
      return;
    }
    const total = IDS.length;
    const i = tiles.current.findIndex((t) => t === document.activeElement);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % total;
    else if (e.key === "ArrowLeft") next = (i - 1 + total) % total;
    else if (e.key === "ArrowDown") next = i < 0 ? 0 : verticalStep(i, 1, total);
    else if (e.key === "ArrowUp") next = i < 0 ? 0 : verticalStep(i, -1, total);
    else if (e.key === "Tab") next = e.shiftKey ? (i - 1 + total) % total : (i + 1) % total;
    if (next >= 0) {
      e.preventDefault();
      tiles.current[next]?.focus();
    }
  };

  /** El brillo de la tarjeta sigue al puntero. */
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${Math.round(e.clientX - r.left)}px`);
    e.currentTarget.style.setProperty("--my", `${Math.round(e.clientY - r.top)}px`);
  };

  const className = ["fl-launch", sheet ? "fl-launch--sheet" : "fl-launch--pop", phase === "open" ? "" : `is-${phase}`]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div className={className}>
      <div className="fl-launch__backdrop" onClick={close} aria-hidden="true" />
      <div
        className="fl-launch__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={!sheet && pos ? { top: pos.top, right: pos.right } : undefined}
        onKeyDown={onKeyDown}
      >
        {sheet && <span className="fl-launch__grab" aria-hidden="true" />}
        <header className="fl-launch__head">
          <h2 id={titleId} className="fl-launch__title">
            Tus apps
          </h2>
          {!sheet && (
            <span className="fl-launch__hint">
              Atajo <kbd>1</kbd>–<kbd>{IDS.length}</kbd>
            </span>
          )}
        </header>
        <div className="fl-launch__grid">
          {IDS.map((id, i) => {
            const app = APPS[id];
            const here = id === current;
            const style = {
              "--i": i,
              "--app": app.color,
              "--app-soft": `${app.color}29`,
              "--app-line": `${app.color}73`,
              "--app-glow": `${app.color}5C`,
            } as CSSProperties;
            return (
              <button
                key={id}
                ref={(el) => {
                  tiles.current[i] = el;
                }}
                type="button"
                className={`fl-tile${WIDE_FIRST && i === 0 ? " fl-tile--wide" : ""}${here ? " is-current" : ""}${
                  launching === id ? " is-launching" : ""
                }`}
                style={style}
                aria-current={here ? "page" : undefined}
                aria-keyshortcuts={String(i + 1)}
                onClick={() => launch(id)}
                onPointerMove={onPointerMove}
              >
                <AppGlyph id={id} size={sheet ? 46 : 50} className="fl-tile__icon" />
                <span className="fl-tile__name">{app.name}</span>
                <span className="fl-tile__desc">{app.description}</span>
                {here ? (
                  <span className="fl-tile__here">Estás aquí</span>
                ) : (
                  <span className="fl-tile__key" aria-hidden="true">
                    {i + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
