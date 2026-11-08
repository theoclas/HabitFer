import { CloudDownloadOutlined, CloudUploadOutlined, FileExcelOutlined } from "@ant-design/icons";
import { Button, Modal, message } from "antd";
import { useRef, useState } from "react";
import { downloadBackup, importBackup } from "../../../api/client";
import type { ImportReport } from "../../../types";
import { notifyHabitsChanged } from "../effects";
import { apiErrorMessage } from "../format";

type Props = { open: boolean; onClose: () => void };

/** El nginx del servidor acepta hasta 5 MB por pedido (deploy/host-nginx/habitfer.conf). */
const MAX_FILE_MB = 4;

function reportLines(r: ImportReport): string[] {
  const lines: [number, string, string][] = [
    [r.habitsCreated, "hábito nuevo", "hábitos nuevos"],
    [r.completions, "día cumplido", "días cumplidos"],
    [r.amounts, "cantidad", "cantidades"],
    [r.relapses, "recaída", "recaídas"],
    [r.freezes, "día congelado", "días congelados"],
    [r.achievements, "medalla", "medallas"],
    [r.challenges, "reto cumplido", "retos cumplidos"],
    [r.moods, "día de ánimo", "días de ánimo"],
    [r.pauses, "pausa", "pausas"],
    [r.projects, "proyecto", "proyectos"],
    [r.tasks, "tarea", "tareas"],
  ];
  return lines.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
}

/** Respaldo: descargar todo (JSON) o el historial (CSV), e importar un respaldo. */
export function DataSheet({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"json" | "csv" | "import" | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const download = async (kind: "json" | "csv") => {
    setBusy(kind);
    try {
      const name = await downloadBackup(kind);
      message.success(`Descargado: ${name}`);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo descargar"));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      message.error(`El archivo pesa más de ${MAX_FILE_MB} MB.`);
      return;
    }
    setBusy("import");
    setReport(null);
    try {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("Ese archivo no es un respaldo de HabitFer (no es JSON).");
      }
      const r = await importBackup(data);
      setReport(r);
      notifyHabitsChanged();
      message.success("Respaldo importado");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 413) message.error(`El respaldo es demasiado grande para subirlo (máximo ${MAX_FILE_MB} MB).`);
      else message.error(err instanceof Error && !("response" in err) ? err.message : apiErrorMessage(err, "No se pudo importar"));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const lines = report ? reportLines(report) : [];

  return (
    <Modal
      open={open}
      onCancel={() => {
        setReport(null);
        onClose();
      }}
      footer={null}
      centered
      width={460}
      title="Respaldo de datos"
    >
      <p className="hf-hint" style={{ marginTop: 0 }}>
        Guarda una copia de todo lo tuyo. Importar suma lo que falte y nunca borra lo que ya tienes, así que puedes usarlo sin miedo.
      </p>
      <div className="hf-data-actions">
        <Button size="large" icon={<CloudDownloadOutlined />} loading={busy === "json"} onClick={() => void download("json")}>
          Descargar respaldo completo (JSON)
        </Button>
        <Button size="large" icon={<FileExcelOutlined />} loading={busy === "csv"} onClick={() => void download("csv")}>
          Descargar historial para Excel (CSV)
        </Button>
        <Button size="large" icon={<CloudUploadOutlined />} loading={busy === "import"} onClick={() => fileRef.current?.click()}>
          Importar un respaldo…
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {report && (
        <div className="hf-data-report" role="status">
          <b>{lines.length ? "Listo. Se sumó:" : "Listo: ya tenías todo, no faltaba nada."}</b>
          {lines.length > 0 && (
            <ul>
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          {report.habitsMerged > 0 && (
            <small>
              {report.habitsMerged === 1 ? "Se revisó 1 hábito que ya tenías." : `Se revisaron ${report.habitsMerged} hábitos que ya tenías.`}
            </small>
          )}
        </div>
      )}
    </Modal>
  );
}
