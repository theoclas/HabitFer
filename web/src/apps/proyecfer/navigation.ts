const BASE = "/app/proyecfer";

export type BackTarget = { to: string; label: string };

export function resolveProyecFerBack(pathname: string): BackTarget | null {
  const guide = pathname.match(/\/workspaces\/([^/]+)\/projects\/([^/]+)\/guides\/[^/]+/);
  if (guide) {
    return {
      to: `${BASE}/workspaces/${guide[1]}/projects/${guide[2]}`,
      label: "Proyecto",
    };
  }

  const project = pathname.match(/\/workspaces\/([^/]+)\/projects\/([^/]+)/);
  if (project) {
    return {
      to: `${BASE}/workspaces/${project[1]}`,
      label: "Workspace",
    };
  }

  const database = pathname.match(/\/workspaces\/([^/]+)\/databases\/[^/]+/);
  if (database) {
    return {
      to: `${BASE}/workspaces/${database[1]}`,
      label: "Workspace",
    };
  }

  const page = pathname.match(/\/workspaces\/([^/]+)\/pages\/[^/]+/);
  if (page) {
    return {
      to: `${BASE}/workspaces/${page[1]}`,
      label: "Workspace",
    };
  }

  const workspace = pathname.match(/\/workspaces\/([^/]+)$/);
  if (workspace) {
    return { to: `${BASE}/workspaces`, label: "Workspaces" };
  }

  return null;
}

export function resolveProyecFerTitle(pathname: string): string {
  if (pathname.includes("/guides/")) return "Guia de trabajo";
  if (pathname.includes("/projects/")) return "Proyecto";
  if (pathname.includes("/pages/")) return "Pagina";
  if (pathname.includes("/databases/")) return "Base de datos";
  if (pathname.match(/\/workspaces\/[^/]+/)) return "Workspace";
  if (pathname.startsWith(`${BASE}/workspaces`)) return "Workspaces";
  if (pathname.startsWith(`${BASE}/stats`)) return "Estadisticas";
  return "ProyecFer";
}
