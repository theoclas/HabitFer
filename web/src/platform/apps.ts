export type AppId = "habitfer" | "proyecfer" | "fernance" | "nutrifer";

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
  },
  fernance: {
    id: "fernance",
    name: "Fernance",
    description: "Finanzas personales, ingresos y créditos",
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
};

export function getLastApp(): AppId | null {
  const v = localStorage.getItem(LAST_APP_KEY);
  return v === "habitfer" || v === "proyecfer" || v === "fernance" || v === "nutrifer" ? v : null;
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
