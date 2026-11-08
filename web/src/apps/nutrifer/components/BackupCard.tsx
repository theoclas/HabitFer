import { DownloadOutlined, FileExcelOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, message } from "antd";
import { useRef, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { downloadNutritionBackup, importNutritionBackup } from "../api";

/** Respaldo de NutriFer: todo en JSON, el diario en CSV para Excel, e importar un respaldo (suma lo que falta). */
export function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"json" | "csv" | "import" | null>(null);

  const download = async (kind: "json" | "csv") => {
    setBusy(kind);
    try {
      const name = await downloadNutritionBackup(kind);
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
      // También sirve el respaldo completo de HabitFer: lo de NutriFer viaja en «nutrition».
      const body =
        parsed && typeof parsed === "object" && (parsed as { app?: string }).app === "HabitFer" ? (parsed as { nutrition?: unknown }).nutrition : parsed;
      if (!body) throw new Error("Ese respaldo de HabitFer no trae nada de NutriFer.");
      const r = await importNutritionBackup(body);
      const total = r.entries + r.water + r.weights + r.fasts + r.foods + r.savedMeals;
      message.success(
        total === 0
          ? "No faltaba nada: todo ya estaba."
          : `Se sumó: ${r.entries} anotaciones, ${r.weights} pesadas, ${r.water} días de agua, ${r.fasts} ayunos, ${r.foods} alimentos y ${r.savedMeals} comidas guardadas.`,
        6,
      );
    } catch (err) {
      message.error(err instanceof SyntaxError ? "Ese archivo no es un respaldo (no es JSON)." : apiErrorMessage(err, "No se pudo importar"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="nf-card" aria-labelledby="nf-goal-backup">
      <h2 id="nf-goal-backup">Respaldo</h2>
      <p className="nf-hint" style={{ margin: 0 }}>
        Tu diario de comida, el agua, el peso, los ayunos, tus alimentos y comidas guardadas. El respaldo completo de HabitFer también lo trae.
      </p>
      <div className="nf-backup">
        <Button icon={<DownloadOutlined />} loading={busy === "json"} onClick={() => void download("json")}>
          Respaldo (JSON)
        </Button>
        <Button icon={<FileExcelOutlined />} loading={busy === "csv"} onClick={() => void download("csv")}>
          Diario para Excel (CSV)
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
      <span className="nf-hint">Importar suma lo que falta y nunca borra ni cambia lo que ya tienes.</span>
    </section>
  );
}
