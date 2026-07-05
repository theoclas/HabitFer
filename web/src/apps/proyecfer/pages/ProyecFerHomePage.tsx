import { PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { Button, Empty } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FeatureCard } from "../../../components/FeatureCard";
import { PageHero } from "../../../components/PageHero";
import { fetchWorkspaces } from "../../../api/proyecfer";
import type { WorkspaceSummary } from "../../../types/proyecfer";

export function ProyecFerHomePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);

  useEffect(() => {
    void fetchWorkspaces().then(setWorkspaces).catch(() => setWorkspaces([]));
  }, []);

  return (
    <div>
      <PageHero
        variant="proyec"
        title="ProyecFer"
        subtitle="Gestiona proyectos colaborativos con tu equipo: tareas, paginas, comentarios e historial."
        actions={
          <>
            <Link to="/app/proyecfer/workspaces">
              <Button type="primary" className="btn-proyec" icon={<TeamOutlined />}>
                Ver workspaces
              </Button>
            </Link>
            <Link to="/app/proyecfer/workspaces">
              <Button icon={<PlusOutlined />}>Crear workspace</Button>
            </Link>
          </>
        }
      />
      {workspaces.length === 0 ? (
        <Empty description="Aun no tienes workspaces" style={{ marginTop: 40 }}>
          <Link to="/app/proyecfer/workspaces">
            <Button type="primary" className="btn-proyec">Crear el primero</Button>
          </Link>
        </Empty>
      ) : (
        <div className="feature-grid">
          {workspaces.slice(0, 6).map((w) => (
            <Link key={w.id} to={`/app/proyecfer/workspaces/${w.id}`}>
              <FeatureCard
                emoji={w.icon ?? "📁"}
                title={w.name}
                meta={`${w.projectCount} proyectos · ${w.memberCount} miembros`}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
