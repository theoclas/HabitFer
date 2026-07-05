export type AppId = "habitfer" | "proyecfer";

export const LAST_APP_KEY = "fersua_last_app";

export type AppConfig = {
  id: AppId;
  name: string;
  description: string;
  color: string;
  basePath: string;
};

export const APPS: Record<AppId, AppConfig> = {
  habitfer: {
    id: "habitfer",
    name: "HabitFer",
    description: "Habitos, tareas personales y estadisticas",
    color: "#2dd4bf",
    basePath: "/app/habitfer",
  },
  proyecfer: {
    id: "proyecfer",
    name: "ProyecFer",
    description: "Proyectos colaborativos, paginas y equipos",
    color: "#6366f1",
    basePath: "/app/proyecfer",
  },
};

export function getLastApp(): AppId | null {
  const v = localStorage.getItem(LAST_APP_KEY);
  return v === "habitfer" || v === "proyecfer" ? v : null;
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
