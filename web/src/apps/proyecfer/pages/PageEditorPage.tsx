import { Button, Input, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../../components/BackButton";
import { createDatabase, fetchPage, savePageBlocks, updatePage } from "../../../api/proyecfer";
import { CommentPanel } from "../components/CommentPanel";
import { PageEditor } from "../components/PageEditor";
import { PageSidebar } from "../components/PageSidebar";
import type { BlockItem, PageDetail } from "../../../types/proyecfer";

export function PageEditorPage() {
  const { workspaceId, pageId } = useParams<{ workspaceId: string; pageId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<PageDetail | null>(null);
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    if (!pageId) return;
    try {
      const p = await fetchPage(pageId);
      setPage(p);
      setTitle(p.title);
      setBlocks(p.blocks);
    } catch {
      message.error("No se pudo cargar la pagina");
    }
  }, [pageId]);

  useEffect(() => { void load(); }, [load]);

  const handleSaveBlocks = async (next: BlockItem[]) => {
    if (!pageId) return;
    try {
      await savePageBlocks(pageId, next.map((b, i) => ({
        type: b.type,
        content: b.content,
        sortOrder: i,
        parentBlockId: b.parentBlockId ?? undefined,
      })));
    } catch {
      message.error("Error al guardar bloques");
    }
  };

  const handleCreateDatabase = async () => {
    if (!pageId) return;
    try {
      const db = await createDatabase(pageId, title + " - DB");
      navigate(`/app/proyecfer/workspaces/${workspaceId}/databases/${db.id}`);
    } catch {
      message.error("No se pudo crear la base de datos");
    }
  };

  const handleSaveTitle = async (nextTitle: string) => {
    if (!pageId || !nextTitle.trim()) return;
    try {
      await updatePage(pageId, { title: nextTitle.trim() });
      setPage((prev) => (prev ? { ...prev, title: nextTitle.trim() } : prev));
    } catch {
      message.error("No se pudo guardar el titulo");
      setTitle(page?.title ?? "");
    }
  };

  if (!page) return null;

  const backTo =
    page.projectId && workspaceId
      ? `/app/proyecfer/workspaces/${workspaceId}/projects/${page.projectId}`
      : `/app/proyecfer/workspaces/${workspaceId}`;
  const backLabel = page.projectId ? "Volver al proyecto" : "Volver al workspace";

  return (
    <div>
      <BackButton to={backTo} label={backLabel} />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={(e) => void handleSaveTitle(e.target.value)}
        onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
        variant="borderless"
        className="page-title-input"
      />
      <div className="split-layout split-layout--editor">
        <PageSidebar workspaceId={workspaceId!} pages={page.childPages} currentPageId={page.id} />
        <div>
          <PageEditor blocks={blocks} onChange={setBlocks} onSave={handleSaveBlocks} />
          {!page.database && (
            <Button style={{ marginTop: 16 }} className="btn-proyec" type="primary" onClick={() => void handleCreateDatabase()}>
              + Crear base de datos
            </Button>
          )}
          {page.database && (
            <Button
              style={{ marginTop: 16 }}
              type="primary"
              className="btn-proyec"
              onClick={() => navigate(`/app/proyecfer/workspaces/${workspaceId}/databases/${page.database!.id}`)}
            >
              Abrir base de datos
            </Button>
          )}
        </div>
        <CommentPanel targetType="PAGE" targetId={page.id} />
      </div>
    </div>
  );
}
