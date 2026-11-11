export type AppId = "habitfer" | "proyecfer" | "fernance" | "nutrifer" | "ferfit";

export const LAST_APP_KEY = "fersua_last_app";

export type AppConfig = {
  id: AppId;
  name: string;
  description: string;
  color: string;
  basePath: string;
  /**
   * Retirada: no sale en el lanzador, en el selector ni en la pantalla de entrada, y su dirección lleva a
   * HabitFer. Su código y sus datos se quedan; para volver a prenderla basta con quitar la marca.
   */
  retired?: boolean;
};

export const APPS: Record<AppId, AppConfig> = {
  habitfer: {
    id: "habitfer",
    name: "HabitFer",
    description: "Hábitos, tareas personales y estadísticas",
    color: "#FF7A1A",
    basePath: "/app/habitfer",
  },
  proyecfer: {
    id: "proyecfer",
    name: "ProyecFer",
    description: "Proyectos colaborativos, páginas y equipos",
    color: "#6366f1",
    basePath: "/app/proyecfer",
    // Retirada el 10 nov 2026: solo se oculta. Para volver a prenderla, borrar esta línea.
    retired: true,
  },
  fernance: {
    id: "fernance",
    name: "FerFinance",
    description: "Tu plata: cuentas, ingresos y créditos",
    color: "#D4AF37",
    basePath: "/app/fernance",
  },
  nutrifer: {
    id: "nutrifer",
    name: "NutriFer",
    description: "Comida colombiana, calorías y nutrientes",
    color: "#46C27A",
    basePath: "/app/nutrifer",
  },
  ferfit: {
    id: "ferfit",
    name: "FerFit",
    description: "Rutinas en casa, tu semana y tu racha",
    color: "#2F6BFF",
    basePath: "/app/ferfit",
  },
};

/** Las apps que se ofrecen (sin las retiradas), en el orden del lanzador. */
export const ACTIVE_APP_IDS: readonly AppId[] = (Object.keys(APPS) as AppId[]).filter((id) => !APPS[id].retired);

function isActiveApp(v: string | null): v is AppId {
  return v !== null && (ACTIVE_APP_IDS as readonly string[]).includes(v);
}

/** La última app abierta. Una retirada (o un valor que no es de ninguna app) cuenta como ninguna. */
export function getLastApp(): AppId | null {
  const v = localStorage.getItem(LAST_APP_KEY);
  return isActiveApp(v) ? v : null;
}

export function setLastApp(id: AppId) {
  localStorage.setItem(LAST_APP_KEY, id);
}

export function appHomePath(id: AppId): string {
  return APPS[id].basePath;
}

export function resolvePostLoginPath(): string {
  const last = getLastApp();
  return last ? appHomePath(last) : "/app/picker";
}
