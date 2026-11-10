import { DownloadOutlined, FileExcelOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button } from "antd";
import { useRef, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { downloadFinanceBackup, importFinanceBackup } from "../api";

/** Respaldo de FerFinance: todo en JSON, los movimientos en CSV para Excel, e importar (suma lo que falta). */
export function BackupCard({ onImported }: { onImported: () => void }) {
  const { message } = App.useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"json" | "csv" | "import" | null>(null);

  const download = async (kind: "json" | "csv") => {
    setBusy(kind);
    try {
      const name = await downloadFinanceBackup(kind);
      message.success(`Descargado: ${name}`);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo descargar"));
    } finally {
      setBusy(null);
    }
  };

  const importFile = async (file: File) => {
    setBusy("import");
    try {
      const parsed: unknown = JSON.parse(await file.text());
      // También sirve el respaldo completo de HabitFer: lo de FerFinance viaja en «finance».
      const body = parsed && typeof parsed === "object" && (parsed as { app?: string }).app === "HabitFer" ? (parsed as { finance?: unknown }).finance : parsed;
      if (!body) throw new Error("Ese respaldo de HabitFer no trae nada de FerFinance.");
      const r = await importFinanceBackup(body);
      const total = r.accounts + r.incomes + r.credits + r.installments;
      message.success(
        total === 0
          ? "No faltaba nada: todo ya estaba."
          : `Se sumó: ${r.accounts} cuentas, ${r.incomes} ingresos, ${r.credits} créditos y ${r.installments} cuotas.`,
        6,
      );
      onImported();
    } catch (err) {
      message.error(
        err instanceof SyntaxError
          ? "Ese archivo no es un respaldo (no es JSON)."
          : err instanceof Error && !("response" in err)
            ? err.message
            : apiErrorMessage(err, "No se pudo importar"),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="ff-card" aria-labelledby="ff-backup-title">
      <h2 id="ff-backup-title" className="ff-section-title">
        Respaldo
      </h2>
      <p className="ff-hint">Tus cuentas (también las de la papelera), ingresos y créditos con sus cuotas. El respaldo completo de HabitFer también lo trae.</p>
      <div className="ff-backup">
        <Button icon={<DownloadOutlined />} loading={busy === "json"} onClick={() => void download("json")}>
          Respaldo (JSON)
        </Button>
        <Button icon={<FileExcelOutlined />} loading={busy === "csv"} onClick={() => void download("csv")}>
          Movimientos para Excel (CSV)
        </Button>
        <Button icon={<UploadOutlined />} loading={busy === "import"} onClick={() => fileRef.current?.click()}>
          Importar un respaldo
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importFile(f);
        }}
      />
      <p className="ff-hint">Importar suma lo que falta y nunca borra ni cambia lo que ya tienes.</p>
    </section>
  );
}
