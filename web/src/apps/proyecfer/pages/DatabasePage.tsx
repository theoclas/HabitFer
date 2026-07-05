import { PlusOutlined } from "@ant-design/icons";
import { Button, Card, Input, Segmented, Table, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BackButton } from "../../../components/BackButton";
import { addDatabaseRow, fetchDatabase, updateDatabaseRow } from "../../../api/proyecfer";
import type { DatabaseDetail, DatabaseRow } from "../../../types/proyecfer";

type ViewType = "TABLE" | "BOARD" | "CALENDAR" | "GALLERY";

function getStatusValue(row: DatabaseRow, statusPropId?: string) {
  if (statusPropId && row.values[statusPropId]) return String(row.values[statusPropId]);
  return "Por hacer";
}

export function DatabasePage() {
  const { workspaceId, databaseId } = useParams<{ workspaceId: string; databaseId: string }>();
  const [db, setDb] = useState<DatabaseDetail | null>(null);
  const [view, setView] = useState<ViewType>("TABLE");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!databaseId) return;
    try {
      const data = await fetchDatabase(databaseId);
      setDb(data);
      if (data.views[0]) setView(data.views[0].type);
    } catch {
      message.error("No se pudo cargar la base de datos");
    }
  }, [databaseId]);

  useEffect(() => { void load(); }, [load]);

  const handleAddRow = async () => {
    if (!databaseId) return;
    setAdding(true);
    try {
      await addDatabaseRow(databaseId, "Nueva fila");
      await load();
    } catch {
      message.error("No se pudo agregar fila");
    } finally {
      setAdding(false);
    }
  };

  const handleCellChange = async (row: DatabaseRow, propId: string, value: unknown) => {
    try {
      await updateDatabaseRow(row.id, { ...row.values, [propId]: value });
      await load();
    } catch {
      message.error("No se pudo guardar");
    }
  };

  const columns = useMemo(() => {
    if (!db) return [];
    const props = db.properties.sort((a, b) => a.sortOrder - b.sortOrder);
    return [
      {
        title: "Titulo",
        dataIndex: ["page", "title"],
        key: "title",
        render: (_: unknown, row: DatabaseRow) => (
          <Input
            defaultValue={row.page.title}
            onBlur={(e) => void updateDatabaseRow(row.id, row.values, e.target.value)}
          />
        ),
      },
      ...props.map((p) => ({
        title: p.name,
        key: p.id,
        render: (_: unknown, row: DatabaseRow) => (
          <Input
            defaultValue={String(row.values[p.id] ?? "")}
            onBlur={(e) => void handleCellChange(row, p.id, e.target.value)}
          />
        ),
      })),
    ];
  }, [db]);

  if (!db) return null;

  const backTo = workspaceId
    ? `/app/proyecfer/workspaces/${workspaceId}/pages/${db.pageId}`
    : "/app/proyecfer/workspaces";

  const statusProp = db?.properties.find((p) => p.name === "Estado");
  const dateProp = db?.properties.find((p) => p.name === "Fecha");

  const statusGroups = ["Por hacer", "En progreso", "Hecho"] as const;
  const rowsByStatus = statusGroups.map((s) => ({
    status: s,
    rows: db!.rows.filter((r) => getStatusValue(r, statusProp?.id) === s),
  }));

  const rowsByDate = db!.rows.reduce<Record<string, DatabaseRow[]>>((acc, row) => {
    const d = dateProp ? String(row.values[dateProp.id] ?? "").slice(0, 10) || "Sin fecha" : "Sin fecha";
    acc[d] = acc[d] ?? [];
    acc[d].push(row);
    return acc;
  }, {});

  return (
    <div>
      <BackButton to={backTo} label="Volver a la pagina" />
      <div className="page-header">
        <Typography.Title level={2} style={{ margin: 0, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
          {db.title}
        </Typography.Title>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Segmented
            value={view}
            onChange={(v) => setView(v as ViewType)}
            options={[
              { value: "TABLE", label: "Tabla" },
              { value: "BOARD", label: "Kanban" },
              { value: "CALENDAR", label: "Calendario" },
              { value: "GALLERY", label: "Galeria" },
            ]}
          />
          <Button type="primary" className="btn-proyec" icon={<PlusOutlined />} loading={adding} onClick={() => void handleAddRow()}>
            Fila
          </Button>
        </div>
      </div>

      {view === "TABLE" && (
        <Card className="panel-card" styles={{ body: { padding: 0 } }}>
          <Table rowKey="id" dataSource={db.rows} columns={columns} pagination={false} scroll={{ x: true }} />
        </Card>
      )}

      {view === "BOARD" && (
        <div className="kanban-board">
          {rowsByStatus.map(({ status, rows }) => (
            <Card key={status} title={status} size="small" className="kanban-column">
              {rows.map((row) => (
                <Card key={row.id} size="small" className="task-card" style={{ marginBottom: 8 }}>{row.page.title}</Card>
              ))}
            </Card>
          ))}
        </div>
      )}

      {view === "CALENDAR" && (
        <div style={{ display: "grid", gap: 12 }}>
          {Object.entries(rowsByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => (
            <Card key={date} title={date} size="small" className="panel-card">
              {rows.map((row) => (
                <div key={row.id} style={{ padding: "6px 0" }}>{row.page.title}</div>
              ))}
            </Card>
          ))}
        </div>
      )}

      {view === "GALLERY" && (
        <div className="feature-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {db.rows.map((row) => (
            <Card
              key={row.id}
              hoverable
              className="feature-card"
              cover={<div style={{ height: 88, background: "linear-gradient(135deg, #6366f122, #1e293b)" }} />}
            >
              {row.page.icon ?? "📄"} {row.page.title}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
