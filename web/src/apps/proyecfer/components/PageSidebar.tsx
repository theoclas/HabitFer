import { Link } from "react-router-dom";
import { Card } from "antd";

type PageRef = { id: string; title: string; icon: string | null };

type Props = {
  workspaceId: string;
  pages: PageRef[];
  currentPageId?: string;
};

export function PageSidebar({ workspaceId, pages, currentPageId }: Props) {
  if (pages.length === 0) return null;

  return (
    <Card size="small" className="panel-card" title="Paginas">
      {pages.map((p) => (
        <Link
          key={p.id}
          to={`/app/proyecfer/workspaces/${workspaceId}/pages/${p.id}`}
          className={`page-sidebar-link ${p.id === currentPageId ? "page-sidebar-link--active" : ""}`}
        >
          {p.icon ?? "📄"} {p.title}
        </Link>
      ))}
    </Card>
  );
}
