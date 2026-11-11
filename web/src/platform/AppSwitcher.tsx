import { DownOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppGlyph } from "./AppGlyph";
import { AppLauncher } from "./AppLauncher";
import { APPS, type AppId, setLastApp } from "./apps";

function detectCurrentApp(pathname: string): AppId {
  if (pathname.startsWith("/app/proyecfer")) return "proyecfer";
  if (pathname.startsWith("/app/fernance")) return "fernance";
  if (pathname.startsWith("/app/nutrifer")) return "nutrifer";
  if (pathname.startsWith("/app/ferfit")) return "ferfit";
  return "habitfer";
}

/** Botón para cambiar de app; abre el lanzador. `compact`: solo el ícono (en el celular no cabe el nombre). */
export function AppSwitcher({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const current = detectCurrentApp(location.pathname);
  const config = APPS[current];
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  // Si cambia la página (por ejemplo con el botón atrás), el lanzador se cierra.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true });
  }, []);

  const launch = useCallback(
    (id: AppId) => {
      setLastApp(id);
      navigate(APPS[id].basePath);
    },
    [navigate],
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`app-switcher-btn${compact ? " app-switcher-btn--compact" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={compact ? `Cambiar de app (ahora: ${config.name})` : undefined}
        title={compact ? config.name : undefined}
        onClick={() => setOpen((v) => !v)}
        style={{
          "--switcher-border": `${config.color}44`,
          "--switcher-bg": `${config.color}14`,
          "--switcher-color": config.color,
        } as React.CSSProperties}
      >
        <AppGlyph id={current} size={compact ? 24 : 22} />
        {!compact && <span className="app-switcher-btn__name">{config.name}</span>}
        {!compact && <DownOutlined className="app-switcher-btn__chev" />}
      </button>
      {open && <AppLauncher current={current} anchor={buttonRef.current} onClose={close} onLaunch={launch} />}
    </>
  );
}
