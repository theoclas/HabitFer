import { FireFilled, ProjectFilled, WalletFilled } from "@ant-design/icons";
import type { CSSProperties, ReactNode } from "react";
import { APPS, type AppId } from "./apps";

/** Aguacate partido (con su pepa): la fruta de NutriFer. Ant Design no trae uno. */
function AvocadoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 2.4c2.7 0 3.7 2.8 4.3 5.2.5 2 2.8 3.6 2.8 7.1a7.1 7.1 0 0 1-14.2 0c0-3.5 2.3-5.1 2.8-7.1.6-2.4 1.6-5.2 4.3-5.2z" />
      <circle cx="12" cy="15.1" r="3.5" fill="#7A4A26" />
      <circle cx="10.9" cy="14" r="0.9" fill="#FFFFFF" fillOpacity="0.55" />
    </svg>
  );
}

/** Una mancuerna: el ícono de FerFit. */
function DumbbellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="1.6" y="8.6" width="3" height="6.8" rx="1.2" />
      <rect x="5" y="5.6" width="3.6" height="12.8" rx="1.4" />
      <rect x="8.4" y="10.7" width="7.2" height="2.6" rx="1" />
      <rect x="15.4" y="5.6" width="3.6" height="12.8" rx="1.4" />
      <rect x="19.4" y="8.6" width="3" height="6.8" rx="1.2" />
    </svg>
  );
}

const GLYPHS: Record<AppId, ReactNode> = {
  habitfer: <FireFilled />,
  proyecfer: <ProjectFilled />,
  fernance: <WalletFilled />,
  nutrifer: <AvocadoIcon />,
  ferfit: <DumbbellIcon />,
};

/** Mezcla un color #RRGGBB con blanco (t > 0) o con negro (t < 0). */
export function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const target = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return (
    "#" +
    [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((c) => Math.round(c + (target - c) * k).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Ícono de la app como en un teléfono: un cuadrito redondeado con el degradado de su color. */
export function AppGlyph({ id, size = 48, className }: { id: AppId; size?: number; className?: string }) {
  const color = APPS[id].color;
  const style = {
    "--glyph-size": `${size}px`,
    "--glyph-hi": shade(color, 0.22),
    "--glyph-lo": shade(color, -0.24),
  } as CSSProperties;
  return (
    <span className={`app-glyph${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      {GLYPHS[id]}
    </span>
  );
}
